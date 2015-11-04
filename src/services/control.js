var fs = require('fs');
var path = require('path');
var async = require('async');
var npm = require('npm');
var tmp = require('tmp');
var config = require('../config');

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
      return callback(e);
    }
    callback(null, doc);
  });
};

// Path functions

var controlRepoPath = path.resolve(config.control_repo_path());

var configPath = function (configFile) {
  return path.resolve(controlRepoPath, path.join('config', configFile));
};

// Read functions

var readContentMap = function (callback) {
  var contentMapPath = configPath(config.control_content_file());

  maybeParseJSON(contentMapPath, {}, function (err, contentMap) {
    if (err) return callback(err);

    callback(null);
  });
};

var readTemplateMap = function (callback) {
  var templateMapPath = configPath(config.control_routes_file());

  maybeParseJSON(templateMapPath, {}, function (err, templateMap) {
    if (err) return callback(err);

    callback(null);
  });
};

var readPlugins = function (callback) {
  var pluginsRoot = path.resolve(controlRepoPath, 'plugins');

  fs.readdir(pluginsRoot, function (err, entries) {
    if (err) {
      if (err.code === 'ENOENT') {
        // No plugins to enumerate.
        return callback(null);
      }

      return callback(err);
    }

    async.filter(entries, function (entry, callback) {
      fs.stat(path.join(pluginsRoot, entry), function (fstat) { callback(fstat.isDirectory()); });
    }, function (dirnames) {
      async.each(dirnames, readPluginDomain, callback);
    });
  });
};

var readPluginDomain = function (rootPath, callback) {
  tmp.dir({prefix: 'npm-cache-'}, function (err, cachePath) {
    if (err) return callback(err);

    npm.load({cache: cachePath}, function (err) {
      if (err) return callback(err);

      npm.commands.install([rootPath], function (err, result) {
        if (err) return callback(err);

        callback(null);
      });
    });
  });
};

var ControlService = {
  read: function (callback) {
    async.each([
      readContentMap,
      readTemplateMap,
      readPlugins
    ], callback);
  },
  update: function (sha, callback) {
    //
  }
};

module.exports = ControlService;
