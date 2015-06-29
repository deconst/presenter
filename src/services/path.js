var path = require('path');
var RequestHelper = require('../helpers/request');

var CONFIG_PATH = 'config';

var PathService = {
    getControlRepoPath: function () {
        return path.resolve(process.env.CONTROL_REPO_PATH);
    },
    getDefaultTemplatesPath: function () {
        return path.resolve('./static');
    },
    getTemplatesPath: function () {
        var templatePath = 'templates/' + RequestHelper.host;
        return path.resolve(this.getControlRepoPath(), templatePath);
    },
    getConfigPath: function (configPath) {
        configPath = configPath || '';
        return path.resolve(this.getControlRepoPath(), CONFIG_PATH, configPath);
    }
};

module.exports = PathService;
