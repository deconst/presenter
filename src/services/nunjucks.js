var fs = require('fs');
var path = require('path');
var async = require('async');
var npm = require('npm');
var logger = require('../server/logging').logger;
var nunjucks = require('nunjucks');
var nunjucksDate = require('nunjucks-date');
var nunjucksFallback = require('./nunjucks-fallback');
var services = {
  path: require('./path')
};

var envs = {};

function createEnvironment (context, callback) {
  var env = new nunjucks.Environment(
    new nunjucks.FileSystemLoader([
      services.path.getTemplatesPath(context),
      services.path.getDefaultTemplatesPath()
    ], { watch: true })
  );

  env.addFilter('date', nunjucksDate);
  env.addFilter('fallback', nunjucksFallback);

  env.addFilter('json', function (data) {
    var string = JSON.stringify(data, null, 4);
    string = string.replace(/</g, '&lt;').replace(/>/g, '&gt;');

    return '<pre><code>' + string + '</code></pre>';
  });

  addPlugins(env, context, function (err, env) {
    callback(err, env);
  });
}

var addPlugins = function (env, context, callback) {
  var pluginPath = services.path.getPluginsPath(context);
  try {
    fs.openSync(pluginPath, 'r');
  } catch(e) {
    logger.warn('Unable to find plugins directory at: ' + pluginPath);
    return callback(null, env);
  }

  if (!fs.statSync(pluginPath).isDirectory()) {
    return callback(null, env);
  }

  async.eachSeries(fs.readdirSync(pluginPath), function (pluginDir, callback) {
    var pluginDependencies = [];

    try {
      var dependencyDict = JSON.parse(
        fs.readFileSync(path.join(pluginPath, pluginDir, 'package.json'), 'utf-8')
      ).dependencies;

      for (var key in dependencyDict) {
        pluginDependencies.push(key + '@' + dependencyDict[key]);
      }
    } catch (e) {
      pluginDependencies = [];
    }

    npm.load({}, function () {
      logger.debug('Installing plugin dependencies for ' + pluginDir + ': ');
      logger.debug(JSON.stringify(pluginDependencies));

      npm.commands.install(path.join(pluginPath, pluginDir), pluginDependencies, function () {
        callback(null, null);
      });
    });
  }, function () {
    logger.debug('Loaded all plugin dependencies.');

    fs.readdirSync(pluginPath).forEach(function (pluginDir) {
      var plugin;

      try {
        plugin = require(path.join(pluginPath, pluginDir));
      } catch(e) {
        logger.error(e);
        return;
      }

      if (plugin.templateFilters && plugin.templateFilters.length > 0) {
        plugin.templateFilters.forEach(function (filter) {
          var originalFilter = filter[1].bind(env);

          filter[1] = function (input) {
            try {
              return originalFilter.apply(env, arguments);
            } catch(e) {
              logger.error(e);
              return input;
            }
          };

          env.addFilter.apply(env, filter);
        });
      }
    });

    return callback(null, env);
  });
};

var NunjucksService = {
  clearEnvironments: function () {
    envs = {};
  },
  getEnvironment: function (context, callback) {
    var host = context.host();

    if (envs[host]) {
      return callback(null, envs[host]);
    }

    createEnvironment(context, function (err, env) {
      envs[host] = env;
      return callback(err, env);
    });
  }
};

module.exports = NunjucksService;
