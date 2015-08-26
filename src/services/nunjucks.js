var fs = require('fs');
var path = require('path');
var logger = require('../server/logging').logger;
var nunjucks = require('nunjucks');
var nunjucksDate = require('nunjucks-date');
var nunjucksFallback = require('./nunjucks-fallback');
var services = {
  path: require('./path')
};

var envs = {};

function createEnvironment (context) {
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

  addPlugins(env, context);

  return env;
}

var addPlugins = function (env, context) {
  var pluginPath = services.path.getPluginsPath(context);
  try {
    fs.openSync(pluginPath, 'r');
  } catch(e) {
    logger.warn('Unable to find plugins directory at: ' + pluginPath);
    return;
  }

  if (!fs.statSync(pluginPath).isDirectory()) {
    return;
  }

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
};

var NunjucksService = {
  clearEnvironments: function () {
    envs = {};
  },
  getEnvironment: function (context) {
    var host = context.host();

    if (envs[host]) {
      return envs[host];
    }

    var env = createEnvironment(context);
    envs[host] = env;
    return env;
  }
};

module.exports = NunjucksService;
