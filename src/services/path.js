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
  getPluginsPath: function (context) {
    return path.resolve(this.getPluginsRoot(), context.host());
  },
  getTemplatesPath: function (context) {
    var templatePath = path.join('templates', context.host());
    return path.resolve(this.getControlRepoPath(), templatePath);
  },
  getConfigPath: function (configPath) {
    configPath = configPath || '';
    return path.resolve(this.getControlRepoPath(), CONFIG_PATH, configPath);
  }
};

module.exports = PathService;
