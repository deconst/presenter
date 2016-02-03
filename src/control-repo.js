var fs = require('fs');
var path = require('path');
var spawn = require('child_process').spawn;

var async = require('async');
var npm = require('npm');

var logger = require('./server/logging').logger;

var NPMInstallInProgress = false;


var NPMUtils = {
  getInstance: function (callback) {
    return npm.load({}, callback);
  },
  cleanCache: function (callback) {
    logger.debug('Cleaning control repo module from NPM cache', {
      moduleName: process.env.CONTROL_REPO_MODULE_NAME
    });

    this.getInstance(function (err, npm) {
      npm.commands.cache(['clean', process.env.CONTROL_REPO_MODULE_NAME], callback);
    });
  }
};

var RequireUtils = {
  cleanCache: function (callback) {
    logger.debug('Cleaning control repo and children from CommonJS module cache', {
      moduleName: process.env.CONTROL_REPO_MODULE_NAME
    });

    // Invalidate the cache for the control repo and all of its children
    var ControlRepoPath = path.resolve(require.resolve(process.env.CONTROL_REPO_MODULE_NAME), '..');
    var controlRepoModulePaths = [ControlRepoPath];

    async.waterfall([
      function (callback) {
        fs.readFile(path.resolve(ControlRepoPath, 'package.json'), 'utf-8', callback);
      },
      function (file, callback) {
        var jsonDocument;
        try {
          jsonDocument = JSON.parse(file);
        } catch (e) {
          return callback(e);
        }

        for(var moduleName in jsonDocument.dependencies) {
          controlRepoModulePaths.push(path.resolve(require.resolve(moduleName), '..'));
        }

        return callback(null);
      }
    ], function (err, result) {
      var pathStartsWithAny = function (path, prefixes) {
        var match = false;
        Array.prototype.forEach.call(prefixes, function (prefix) {
          if(path.indexOf(prefix) === 0) {
            match = true;
          }
        });

        return match;
      };

      var modulesToCacheBust = [];
      for(var moduleName in require.cache) {
        if(pathStartsWithAny(moduleName, controlRepoModulePaths)) {
          modulesToCacheBust.push(moduleName);
        }
      }

      logger.debug('Clearing cached control repo modules', {
        modules: modulesToCacheBust
      });
      
      modulesToCacheBust.forEach(function (module) {
        delete require.cache[module];
      });

      return callback(err);
    });
  }
};

var ControlRepo = {
  loaded: function () {
    try {
      require.resolve(process.env.CONTROL_REPO_MODULE_NAME);
      return true;
    } catch (e) {
      return false;
    }
  },
  // We want this to be as idempotent as possible
  reload: function (callback) {
    callback = callback || function () {};
    var startTime = Date.now();
    logger.debug('Beginning control repo reload', {});

    async.waterfall([
      function (callback) {
        if(NPMInstallInProgress) {
          return callback('NPM Install already in progress');
        }

        NPMInstallInProgress = true;
        logger.debug('Running npm install ' + process.env.CONTROL_REPO_MODULE);
        var npmInstall = spawn('npm', ['install', process.env.CONTROL_REPO_MODULE]);

        npmInstall.on('close', function (code) {
          NPMInstallInProgress = false;
          if(code !== 0) {
            return callback('npm install exited with code ' + code);
          }

          return callback(null);
        });
      },
      function (callback) {
        return RequireUtils.cleanCache(arguments[arguments.length - 1]);
      }
    ], function (err, result) {
      if (err) {
        logger.warn('Control repo reload aborted', {
          error: err,
          duration: Date.now() - startTime
        });
      } else {
        logger.debug('Finished control repo reload', {
          duration: Date.now() - startTime
        });
      }

      return callback(err, result);
    });
  },
  getInstance: function () {
    return require(process.env.CONTROL_REPO_MODULE_NAME);
  }
};

module.exports = ControlRepo;
