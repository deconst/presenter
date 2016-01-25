var path = require('path');
var globby = require('globby');
var config = require('../config');


var CONFIG_PATH = 'config';

var PathService = {
  getControlRepoPath: function () {
    return path.resolve(config.control_repo_path());
  },
  getDefaultTemplatesPath: function () {
    return path.resolve('./static');
  },
  getPluginsRoot: function () {
    return path.resolve(this.getControlRepoPath(), 'plugins');
  },
  getPluginsPath: function (domain) {
    return path.resolve(this.getPluginsRoot(), domain);
  },
  getTemplatesRoot: function (domain) {
    return path.resolve(this.getControlRepoPath(), 'templates');
  },
  getTemplatesPath: function (domain) {
    return path.resolve(this.getTemplatesRoot(), domain);
  },
  getAssetPath: function () {
    return path.resolve(PathService.getControlRepoPath(), 'assets');
  },
  getConfigPath: function (configPath) {
    configPath = configPath || '';
    return path.resolve(this.getControlRepoPath(), CONFIG_PATH, configPath);
  },
  getContentFiles: function () {
    if(process.env.CONTROL_CONTENT_FILE) {
      return globby.sync([this.getConfigPath(process.env.CONTROL_CONTENT_FILE)]);
    }

    return globby.sync([
      this.getConfigPath(config.control_content_file()),
      this.getConfigPath('content.d/**/*')
    ]);
  },
  getRewritesFiles: function () {
    if(process.env.CONTROL_REWRITES_FILE) {
      return globby.sync([this.getConfigPath(process.env.CONTROL_REWRITES_FILE)]);
    }

    return globby.sync([
      this.getConfigPath(config.control_rewrites_file()),
      this.getConfigPath('rewrites.d/**/*')
    ]);
  },
  getRoutesFiles: function () {
    if(process.env.CONTROL_ROUTES_FILE) {
      return globby.sync([this.getConfigPath(process.env.CONTROL_ROUTES_FILE)]);
    }

    return globby.sync([
      this.getConfigPath(config.control_routes_file()),
      this.getConfigPath('routes.d/**/*')
    ]);
  }
};

module.exports = PathService;
