var logger = require('../server/logging').logger;
var fs = require('fs');
var nunjucks = require('nunjucks');
var nunjucksDate = require('nunjucks-date');
var nunjucksFallback = require('./nunjucks-fallback');
var PathService = require('./path');

var envs = {};
var staticEnv = null;

var NunjucksService = {
  clearEnvironments: function () {
    envs = {};
  },
  getEnvironment: function (context, callback) {
    var domain = context.host();

    if (!envs[domain]) {
      logger.warn('Missing environment for domain', {
        domain: domain
      });

      if (staticEnv === null) {
        staticEnv = createEnvironment(null);
      }

      return callback(null, staticEnv);
    }

    callback(null, envs[domain]);
  },
  installEnvironment: function (domain, plugins) {
    var env = createEnvironment(domain);

    plugins.forEach(function (plugin) {
      addPlugin(env, plugin);
    });

    envs[domain] = env;
  }
};

module.exports = NunjucksService;

var createEnvironment = function (domain) {
  var templates = {};

  var templatePaths = [PathService.getDefaultTemplatesPath()];
  if (domain) {
    templatePaths.push(PathService.getTemplatesPath(domain));
  }

  templatePaths.forEach(function (templatePath) {
    var isDir = false;
    try {
      isDir = fs.statSync(templatePath).isDirectory();
    } catch (e) {
      if (e.code !== 'ENOENT') {
        logger.error('Unable to load templates', {
          templatePath: templatePath,
          errMessage: e.message,
          errCode: e.code,
          stack: e.stack
        });
      }
      return;
    }

    if (isDir) {
      logger.debug('Loading templates', {
        domain: domain,
        templatePath: templatePath
      });
      nunjucks.precompile(templatePath, {
        env: env,
        include: [/^./],
        wrapper: function (tpls) {
          tpls.forEach(function (tpl) {
            templates[tpl.name] = (new Function(tpl.template))();
          });
        }
      });
    }
  });

  logger.debug('Loaded templates', {
    domain: domain,
    templateNames: Object.keys(templates)
  });

  var loader = new nunjucks.PrecompiledLoader(templates);

  var env = new nunjucks.Environment([loader]);

  env.addFilter('date', nunjucksDate);
  env.addFilter('fallback', nunjucksFallback);
  env.addFilter('json', function (data) {
    var string = JSON.stringify(data, null, 4);
    string = string.replace(/</g, '&lt;').replace(/>/g, '&gt;');

    return '<pre><code>' + string + '</code></pre>';
  });

  return env;
};

var addPlugin = function (env, plugin) {
  if (!plugin.templateFilters) {
    return;
  }

  plugin.templateFilters.forEach(function (filter) {
    var originalFilter = filter[1].bind(env);

    filter[1] = function (input) {
      try {
        return originalFilter.apply(env, arguments);
      } catch (e) {
        logger.error('Filter application error', {
          errMessage: e.message,
          stack: e.stack
        });

        return input;
      }
    };

    env.addFilter.apply(env, filter);
  });
};
