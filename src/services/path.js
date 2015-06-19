var path = require('path');

var TEMPLATE_PATH = 'layouts/drc';
var CONFIG_PATH = 'config';

var PathService = {
    getControlRepoPath: function () {
        return path.resolve(process.env.CONTROL_REPO_PATH);
    },
    getTemplatesPath: function () {
        return path.resolve(this.getControlRepoPath(), TEMPLATE_PATH);
    },
    getConfigPath: function () {
        return path.resolve(this.getControlRepoPath(), CONFIG_PATH);
    }
};

module.exports = PathService;
