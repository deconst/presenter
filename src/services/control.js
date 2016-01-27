var fs = require('fs');
var path = require('path');
var async = require('async');
var npm = require('npm');
var tmp = require('tmp');
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

/**
 * @todo This file is way too long. All the git stuff needs to be somewhere else.
 * @todo Fold plugin handling into control repo methods
 * @todo remove subdirectories() function once no longer used
 */

var ControlService = {
  load: function (callback) {
    var startTs = Date.now();
    logger.info('Loading control repository');

    NunjucksService.initialize(function (err) {
      if (err) {
        logger.error('Unable to bootstrap nunjucks templates.', {
          errMessage: err.message,
          stack: err.stack,
          duration: Date.now() - startTs
        });

        return callback(false);
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

          return callback(false);
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

        callback(true);
      });
    });
  },
  update: function (sha, callback) {
    // The callback is optional.
    if (!callback) {
      callback = function () {};
    }

    if (updateInProgress) {
      return callback(false);
    }

    var startTs = Date.now();
    logger.info('Updating control repository', {
      sha: sha
    });

    if (sha !== null && lastAttemptSHA === sha) {
      logger.info('Skipping load of already-attempted SHA', {
        sha: sha,
        lastAttemptSHA: lastAttemptSHA
      });
      return callback(false);
    }
    lastAttemptSHA = sha;

    var isGit = !!config.control_repo_url();
    var shouldUpdate = (sha === null) || (sha !== controlSHA);

    if (!shouldUpdate) {
      logger.info('Control repository SHA is already up to date.', {
        sha: sha
      });

      return callback(false);
    }

    updateInProgress = true;

    var handleErr = function (err) {
      logger.error('Unable to update control repository', {
        errMessage: err.message,
        stack: err.stack,
        sha: sha
      });

      updateInProgress = false;
      callback(false);
    };

    var gitStartTs = null;
    var gitCompletePayload = null;

    var andLoad = function (err, newSHA) {
      if (err) return handleErr(err);

      if (gitStartTs !== null && gitCompletePayload !== null) {
        gitCompletePayload.duration = Date.now() - gitStartTs;
        var msg = gitCompletePayload.message;
        delete gitCompletePayload.message;

        logger.info(msg, gitCompletePayload);
      }

      /**
       * @todo The signature for this function should be function (err, result)
       */
      this.load(function (ok) {
        if (ok) {
          logger.info('Control repository update complete.', {
            fromSHA: controlSHA,
            toSHA: newSHA,
            duration: Date.now() - startTs
          });

          controlSHA = newSHA;
        } else {
          logger.error('Control repository load failed.', {
            currentSHA: controlSHA,
            toSHA: sha
          });
        }

        updateInProgress = false;
        callback(ok);
      });
    }.bind(this);

    if (isGit) {
      var parentPath = path.dirname(PathService.getControlRepoPath());

      mkdirp(parentPath, function (err) {
        if (err) return handleErr(err);

        fs.readdir(PathService.getControlRepoPath(), function (err, contents) {
          if (err) {
            if (err.code === 'ENOENT') {
              // New repository.

              logger.debug('Beginning control repository clone', {
                url: config.control_repo_url(),
                branch: config.control_repo_branch()
              });
              gitCompletePayload = {
                message: 'Completed control repository clone',
                url: config.control_repo_url(),
                branch: config.control_repo_branch()
              };
              gitStartTs = Date.now();

              gitClone(
                config.control_repo_url(),
                config.control_repo_branch(),
                PathService.getControlRepoPath(),
                andLoad);
              return;
            }

            return handleErr(err);
          }

          // Existing repository.
          logger.debug('Beginning control repository pull');
          gitCompletePayload = {message: 'Completed control repository pull'};
          gitStartTs = Date.now();

          gitPull(
            PathService.getControlRepoPath(),
            andLoad);
        });
      });
    } else {
      // Non-git repository. Most likely a local mount.
      logger.debug('Skipping update for non-git control repository.');

      return andLoad(null, 'non-git');
    }
  },
  getControlSHA: function () {
    return controlSHA;
  }
};

module.exports = ControlService;

var subdirectories = function (rootPath, callback) {
  fs.readdir(rootPath, function (err, entries) {
    if (err) return callback(err);

    async.filter(entries, function (entry, cb) {
      fs.stat(path.join(rootPath, entry), function (err, fstat) {
        if (err) return callback(err);
        cb(fstat.isDirectory());
      });
    }, function (dirs) {
      return callback(null, dirs);
    });
  });
};

var readCurrentSHA = function (repoPath, callback) {
  return function (err, stdout, stderr) {
    if (err) {
      err.stdout = stdout;
      err.stderr = stderr;
      return callback(err);
    }

    childProcess.execFile(
      '/usr/bin/git',
      ['rev-parse', 'HEAD'],
      {cwd: repoPath},
      function (err, stdout, stderr) {
        if (err) {
          err.stdout = stdout;
          err.stderr = stderr;
          return callback(err);
        }

        callback(null, stdout.replace(/\r?\n$/, ''));
      }
    );
  };
};

var gitClone = function (url, branch, repoPath, callback) {
  childProcess.execFile(
    '/usr/bin/git',
    ['clone', '--branch', branch, url, repoPath],
    readCurrentSHA(repoPath, callback)
  );
};

var gitPull = function (repoPath, callback) {
  childProcess.execFile(
    '/usr/bin/git',
    ['pull'],
    {cwd: repoPath},
    readCurrentSHA(repoPath, callback)
  );
};

// Read functions

var readContentMap = function (callback) {
  ControlRepo.getContentMaps(function (err, maps) {
    if(err) {
      return callback(err, null);
    }

    logger.debug('Successfully loaded content maps', {
      maps: maps
    });

    callback(err, maps);
  });
};

var readTemplateMap = function (callback) {
  ControlRepo.getRouteMaps(function (err, maps) {
    if(err) {
      return callback(err, null);
    }

    logger.debug('Successfully loaded template maps', {
      maps: maps
    });

    callback(err, maps);
  });
};

var readRewriteMap = function (callback) {
  ControlRepo.getRewriteMaps(function (err, maps) {
    if(err) {
      return callback(err, null);
    }

    logger.debug('Successfully loaded rewrite maps', {
      maps: maps
    });

    callback(err, maps);
  });
};

var loadPlugins = function (callback) {
  var pluginsRoot = PathService.getPluginsRoot();
  var beginTs = Date.now();
  logger.debug('Beginning plugin load', {
    path: pluginsRoot
  });

  subdirectories(pluginsRoot, function (err, subdirs) {
    if (err) {
      if (err.code === 'ENOENT') {
        // No plugins to enumerate.
        return callback(null, {});
      }

      return callback(err);
    }

    async.map(subdirs, loadDomainPlugins, function (err, results) {
      if (err) return callback(err);

      logger.debug('Successfully loaded plugins', {
        path: pluginsRoot,
        pluginCount: results.length,
        duration: Date.now() - beginTs
      });

      var output = {};
      for (var i = 0; i < results.length; i++) {
        output[subdirs[i]] = results[i];
      }

      callback(null, output);
    });
  });
};

var loadDomainPlugins = function (domain, callback) {
  var domainRoot = path.join(PathService.getPluginsRoot(), domain);

  subdirectories(domainRoot, function (err, subdirs) {
    if (err) return callback(err);

    async.map(subdirs, function (subdir, cb) {
      loadDomainPlugin(path.join(domainRoot, subdir), cb);
    }, function (err, results) {
      if (err) return callback(err);

      callback(null, results);
    });
  });
};

var loadDomainPlugin = function (pluginRoot, callback) {
  var startTs = Date.now();
  logger.debug('Loading plugin', {
    pluginRoot: pluginRoot
  });

  var deps = null;
  var plugin = null;

  var createDir = function (cb) {
    if (cachePath !== null) {
      return cb(null);
    }

    tmp.dir({prefix: 'npm-cache-'}, function (err, cp) {
      cachePath = cp;
      cb(err);
    });
  };

  var parseDependencies = function (cb) {
    fs.readFile(path.join(pluginRoot, 'package.json'), {encoding: 'utf-8'}, function (err, doc) {
      if (err) return cb(err);

      var depDoc = {};
      try {
        depDoc = JSON.parse(doc);
      } catch (e) {
        return cb(e);
      }

      deps = [];
      for (var key in depDoc.dependencies) {
        deps.push(key + '@' + depDoc.dependencies[key]);
      }

      cb(null);
    });
  };

  var installDependencies = function (cb) {
    npm.load({cache: cachePath}, function (err) {
      if (err) return cb(err);

      npm.commands.install(pluginRoot, deps, function (err, result) {
        if (err) return cb(err);

        logger.debug('Plugin dependencies installed', {
          pluginRoot: pluginRoot,
          duration: Date.now() - startTs
        });

        var requireTs = Date.now();
        try {
          plugin = require(pluginRoot);
        } catch (e) {
          return callback(e);
        }

        logger.debug('Plugin required', {
          pluginRoot: pluginRoot,
          duration: Date.now() - requireTs
        });

        cb(null);
      });
    });
  };

  async.series([
    createDir,
    parseDependencies,
    installDependencies
  ], function (err) {
    return callback(err, plugin);
  });
};

var loadTemplates = function (callback) {
  var startTs = Date.now();
  logger.debug('Beginning template preload', {});

  var sources = {};

  async.each(ControlRepo.sites, function (site, cb) {
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
