var fs = require('fs');
var path = require('path');
var async = require('async');
var npm = require('npm');
var childProcess = require('child_process');
var mkdirp = require('mkdirp');

var config = require('../config');
var logger = require('../server/logging').logger;
var ControlRepo = require('../control-repo');
var PathService = require('./path');
var ContentRoutingService = require('./content/routing');
var TemplateRoutingService = require('./template/routing');
var RewriteService = require('./rewrite');
var NunjucksService = require('./nunjucks');
var createAtomicLoader = require('./nunjucks/atomic-loader');

var controlSHA = null;
var lastAttemptSHA = null;
var updateInProgress = false;
var cachePath = null;

var ControlRepoUpdater = {
  load: function (callback) {
    callback = callback || function () {};
    var startTs = Date.now();
    logger.info('Loading control repository');

    NunjucksService.initialize(function (err) {
      if (err) {
        logger.error('Unable to bootstrap nunjucks templates.', {
          errMessage: err.message,
          stack: err.stack,
          duration: Date.now() - startTs
        });

        return callback(new Error('Unable to bootstrap nunjucks templates.'));
      }

      async.parallel({
        contentMap: readContentMap,
        templateMap: readTemplateMap,
        rewriteMap: readRewriteMap,
        plugins: loadPlugins,
        loaders: loadTemplates
      }, function (err, result) {
        if (err) {
          logger.error('Unable to load control repository', {
            errMessage: err.message,
            stack: err.stack,
            duration: Date.now() - startTs
          });

          return callback(new Error('Unable to load control repository.'));
        }

        ContentRoutingService.setContentMap(result.contentMap);
        TemplateRoutingService.setTemplateMap(result.templateMap);
        RewriteService.setRewriteMap(result.rewriteMap);

        var domains = [];
        for (var domain in result.contentMap) {
          var plugins = result.plugins[domain] || [];
          var loaders = [];
          if (result.loaders[domain]) {
            loaders.push(result.loaders[domain]);
          }

          NunjucksService.installEnvironment(domain, loaders, plugins);

          domains.push(domain);
        }

        logger.info('Successfully loaded control repository', {
          domains: domains,
          duration: Date.now() - startTs
        });

        callback(null);
      });
    });
  },
  update: function (callback) {
    // The callback is optional.
    if (!callback) {
      callback = function () {};
    }

    if (updateInProgress) {
      return callback(new Error('Control Repo update already in progress'), null);
    }

    updateInProgress = true;

    // Do something to determine whether a reload is necessary.
    ControlRepo.reload(function (err) {
      ControlRepoUpdater.load(function (err) {
        updateInProgress = false;
        callback(err);
      });
    });
  }
};

module.exports = ControlRepoUpdater;

/**
 * @todo This interval is not how we want to check for control repo updates.
 */
setInterval(function () {
  ControlRepoUpdater.update(function () {
    ControlRepoUpdater.load(function (err) {
      updateInProgress = false;
    });
  });
}, 60000);



// Read functions
var readContentMap = function (callback) {
  ControlRepo.getInstance().getContentMaps(function (err, maps) {
    if (err) {
      return callback(err, null);
    }

    logger.debug('Successfully loaded content maps', {
      // maps: maps
    });

    callback(err, maps);
  });
};

var readTemplateMap = function (callback) {
  ControlRepo.getInstance().getRouteMaps(function (err, maps) {
    if (err) {
      return callback(err, null);
    }

    logger.debug('Successfully loaded template maps', {
      // maps: maps
    });

    callback(err, maps);
  });
};

var readRewriteMap = function (callback) {
  ControlRepo.getInstance().getRewriteMaps(function (err, maps) {
    if (err) {
      return callback(err, null);
    }

    logger.debug('Successfully loaded rewrite maps', {
      // maps: maps
    });

    callback(err, maps);
  });
};

var loadPlugins = function (callback) {
  var startTs = Date.now();
  logger.debug('Beginning plugin load', {});

  var allPlugins = {};

  async.each(ControlRepo.getInstance().sites, function (site, cb) {
    site.getPlugins(function (err, plugins) {
      allPlugins[site.domain] = plugins;
      return cb();
    });
  }, function (err) {
    logger.debug('Finished plugin load', {
      duration: Date.now() - startTs
    });

    return callback(null, allPlugins);
  });
};

var loadTemplates = function (callback) {
  var startTs = Date.now();
  logger.debug('Beginning template preload', {});

  var sources = {};

  async.each(ControlRepo.getInstance().sites, function (site, cb) {
    site.getTemplateSources(function (err, templateSources) {
      createAtomicLoader(templateSources, function (err, loader) {
        sources[site.domain] = loader;
        cb();
      });
    });
  }, function (err) {
    logger.debug('Finished template preload', {
      duration: Date.now() - startTs
    });
    callback(null, sources);
  });
};
