var path = require('path');
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
  }
};

module.exports = PathService;
