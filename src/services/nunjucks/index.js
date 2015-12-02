var nunjucks = require('nunjucks');
var nunjucksDate = require('nunjucks-date');

var logger = require('../../server/logging').logger;
var fallback = require('./fallback');
var createAtomicLoader = require('./atomic-loader');
var PathService = require('../path');
var ContentService = require('../content');
var ContentRoutingService = require('../content/routing');

var envs = {};
var staticEnv = null;
var staticLoader = null;

var NunjucksService = {
  initialize: function (callback) {
    if (staticEnv && staticLoader) {
      return callback(null);
    }

    createAtomicLoader(PathService.getDefaultTemplatesPath(), function (err, loader) {
      if (err) return callback(err);

      staticLoader = loader;
      staticEnv = createEnvironment(null, [staticLoader]);
      callback(null);
    });
  },
  clearEnvironments: function () {
    envs = {};
  },
  getEnvironment: function (context, callback) {
    var domain = context.host();

    if (!envs[domain]) {
      logger.warn('Missing environment for domain', {
        domain: domain
      });

      return callback(null, staticEnv);
    }

    callback(null, envs[domain]);
  },
  installEnvironment: function (domain, loaders, plugins) {
    var env = createEnvironment(domain, loaders);

    plugins.forEach(function (plugin) {
      addPlugin(env, plugin);
    });

    envs[domain] = env;
  }
};

module.exports = NunjucksService;

var createEnvironment = function (domain, loaders) {
  loaders.push(staticLoader);
  var env = new nunjucks.Environment(loaders, {
    autoescape: false
  });

  env.addFilter('date', nunjucksDate);
  env.addFilter('fallback', fallback);
  env.addFilter('json', function (data) {
    var string = JSON.stringify(data, null, 4);
    string = string.replace(/</g, '&lt;').replace(/>/g, '&gt;');

    return '<pre><code>' + string + '</code></pre>';
  });
  env.addFilter('search', function (query, pageNumber, perPage, callback) {
    var context = this.ctx.deconst.context;

    // perPage and pageNumber are optional.
    if (!(callback instanceof Function)) {
      callback = perPage;
      perPage = null;
    }
    if (!(callback instanceof Function)) {
      callback = pageNumber;
      pageNumber = null;
    }

    ContentService.getSearch(query, pageNumber, perPage, function (err, r) {
      if (err) return callback(err);

      r.results = r.results.filter(function (each) {
        each.url = ContentRoutingService.getPresentedUrl(context, each.contentID, true);
        return each.url !== null;
      });

      // Compute the page count as well.
      r.pages = Math.ceil(r.total / (perPage || 10));

      callback(null, r);
    });
  }, true);

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
