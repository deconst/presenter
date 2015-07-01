var url = require('url');
var RequestHelper = require('../helpers/request');

var SITE_DIRECTORY = '/';

var UrlService = {
    getSiteUrl: function (path) {
        path = path || '';
        var siteUrl = RequestHelper.protocol + '://' + RequestHelper.host;

        return url.resolve(siteUrl + SITE_DIRECTORY, path);
    },
    getSitePath: function (path) {
        path = path || '';
        return url.resolve(SITE_DIRECTORY, path);
    }
};

module.exports = UrlService;
