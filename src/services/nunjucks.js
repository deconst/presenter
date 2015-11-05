var logger = require('../server/logging').logger;
var nunjucks = require('nunjucks');
var nunjucksDate = require('nunjucks-date');
var nunjucksFallback = require('./nunjucks-fallback');
var PathService = require('./path');

var envs = {};

var NunjucksService = {
  clearEnvironments: function () {
    envs = {};
  },
  getEnvironment: function (context, callback) {
    var domain = context.host();

    if (!envs[domain]) {
      return callback(new Error('Missing environment for domain'));
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
  var env = new nunjucks.Environment();

  env.addFilter('date', nunjucksDate);
  env.addFilter('fallback', nunjucksFallback);
  env.addFilter('json', function (data) {
    var string = JSON.stringify(data, null, 4);
    string = string.replace(/</g, '&lt;').replace(/>/g, '&gt;');

    return '<pre><code>' + string + '</code></pre>';
  });

  env.precompile(PathService.getTemplatesPath(domain), {env: env});
  env.precompile(PathService.getDefaultTemplatesPath(), {env: env});

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
