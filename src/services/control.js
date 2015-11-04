var fs = require('fs');
var path = require('path');
var async = require('async');
var npm = require('npm');
var tmp = require('tmp');
var git = require('nodegit');
var mkdirp = require('mkdirp');

var config = require('../config');
var logger = require('../server/logging').logger;
var PathService = require('./path');
var ContentRoutingService = require('./content/routing');
var TemplateRoutingService = require('./template/routing');

var controlSHA = null;

var maybeParseJSON = function (filename, def, callback) {
  fs.readFile(filename, {encoding: 'utf-8'}, function (err, body) {
    if (err) {
      if (err.code === 'ENOENT') {
        return callback(null, def);
      }

      return callback(err);
    }

    var doc;
    try {
      doc = JSON.parse(body);
    } catch (e) {
      logger.warning('Configuration file contained invalid JSON', {
        errMessage: e.message,
        filename: filename,
        source: body
      });

      return callback(e);
    }
    callback(null, doc);
  });
};

var subdirectories = function (rootPath, callback) {
  fs.readdir(rootPath, function (err, entries) {
    if (err) return callback(err);

    async.filter(entries, function (entry, cb) {
      fs.stat(path.join(rootPath, entry), function (err, fstat) {
        if (err) return cb(err);
        cb(null, fstat.isDirectory());
      });
    }, callback);
  });
};

var gitClone = function (url, branch, repoPath, callback) {
  git.Clone(url, path, {checkoutBranch: branch})
  .then(function (repository) {
    return repository.getHeadCommit();
  })
  .then(function (commit) {
    return commit.sha();
  })
  .catch(function (err) {
    return callback(err, null);
  })
  .done(function (sha) {
    return callback(null, sha);
  });
};

var gitPull = function (repoPath, callback) {
  var repo = null;
  var conf = null;

  var currentBranch = null;
  var upstreamRemote = null;
  var upstreamRef = null;

  git.Repository.open(PathService.getControlRepoPath())
  .then(function (repository) {
    repo = repository;

    return repo.getCurrentBranch();
  })
  .then(function (branch) {
    currentBranch = branch.shorthand();

    return repo.config();
  })
  .then(function (config) {
    conf = config;

    return conf.getString('branch.' + currentBranch + '.remote');
  })
  .then(function (ur) {
    upstreamRemote = ur;

    return conf.getString('branch.' + currentBranch + '.merge');
  })
  .then(function (um) {
    upstreamRef = um.replace(/^refs\/heads\//, '');

    return repo.fetch(upstreamRemote, {});
  })
  .then(function () {
    return repo.mergeBranches(currentBranch, upstreamRemote + '/' + upstreamRef);
  })
  .then(function () {
    return repo.getHeadCommit();
  })
  .then(function (commit) {
    return commit.sha();
  })
  .catch(function (err) {
    return callback(err, null);
  })
  .done(function (newSHA) {
    repo.free();

    return callback(null, newSHA);
  });
};

// Read functions

var readContentMap = function (callback) {
  var contentMapPath = PathService.configPath(config.control_content_file());
  logger.debug('Beginning content map load', {
    filename: contentMapPath
  });

  maybeParseJSON(contentMapPath, {}, function (err, contentMap) {
    if (err) return callback(err);

    logger.debug('Successfully loaded content map', {
      filename: contentMapPath
    });
    callback(null, contentMap);
  });
};

var readTemplateMap = function (callback) {
  var templateMapPath = PathService.configPath(config.control_routes_file());
  logger.debug('Begining template map load', {
    filename: templateMapPath
  });

  maybeParseJSON(templateMapPath, {}, function (err, templateMap) {
    if (err) return callback(err);

    logger.debug('Successfully loaded template map', {
      filename: templateMapPath
    });
    callback(null, templateMap);
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
        duration: Date.now() - beginTs
      });
      callback(null, results);
    });
  });
};

var loadDomainPlugins = function (domainRoot, callback) {
  subdirectories(domainRoot, function (err, subdirs) {
    if (err) return callback(err);

    async.map(subdirs, function (subdir, cb) {
      loadDomainPlugin(path.join(domainRoot, subdir), cb);
    }, function (err, results) {
      if (err) return callback(err);

      var output = {};
      for (var i = 0; i < results.length; i++) {
        output[subdirs[i]] = results[i];
      }

      callback(null, output);
    });
  });
};

var loadDomainPlugin = function (pluginRoot, callback) {
  var startTs = Date.now();
  logger.debug('Loading plugin', {
    pluginRoot: pluginRoot
  });

  tmp.dir({prefix: 'npm-cache-'}, function (err, cachePath) {
    if (err) return callback(err);

    npm.load({cache: cachePath}, function (err) {
      if (err) return callback(err);

      npm.commands.install([pluginRoot], function (err, result) {
        if (err) return callback(err);

        logger.debug('Plugin dependencies installed', {
          pluginRoot: pluginRoot,
          duration: Date.now() - startTs
        });

        var loadTs = Date.now();
        var plugin = null;
        try {
          plugin = require(pluginRoot);
        } catch (e) {
          return callback(e);
        }

        logger.debug('Plugin loaded', {
          pluginRoot: pluginRoot,
          duration: Date.now() - loadTs
        });

        callback(null, plugin);
      });
    });
  });
};

var ControlService = {
  load: function (callback) {
    var startTs = Date.now();
    logger.info('Loading control repository');

    async.parallel({
      contentMap: readContentMap,
      templateMap: readTemplateMap,
      plugins: loadPlugins
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

      logger.info('Successfully loaded control repository', {
        duration: Date.now() - startTs
      });

      callback(true);
    });
  },
  update: function (sha, callback) {
    var isGit = !!config.control_repo_url();
    var shouldUpdate = (sha === null) || (sha !== controlSHA);

    if (!shouldUpdate || !isGit) {
      return this.load(function (ok) {
        callback(null, ok);
      });
    }

    var andLoad = function (err, newSHA) {
      if (err) return callback(err);

      this.load(function (ok) {
        if (ok) {
          controlSHA = newSHA;
        }

        callback(null, ok);
      });
    };

    if (isGit) {
      var parentPath = path.dirname(PathService.getControlRepoPath());

      mkdirp(parentPath, function (err) {
        if (err) return callback(err);

        fs.readdir(PathService.getControlRepoPath(), function (err, contents) {
          if (err) {
            if (err.code === 'ENOENT') {
              // New repository.
              gitClone(
                config.control_repo_url(),
                config.control_repo_branch(),
                PathService.getControlRepoPath(),
                andLoad);
              return;
            }

            return callback(err, false);
          }

          // Existing repository.
          gitPull(
            PathService.getControlRepoPath(),
            andLoad);
        });
      });
    } else {
      // Non-git repository. Most likely a local mount.
      controlSHA = 'non-git';

      return andLoad();
    }
  },
  getControlSHA: function () {
    return controlSHA;
  }
};

module.exports = ControlService;
