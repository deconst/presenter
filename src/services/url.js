var url = require('url');

var SITE_URL = 'https://developer.rackspace.com';
var SITE_DIRECTORY = '/';

var UrlService = {
    getSiteUrl: function (path) {
        path = path || '';
        return url.resolve(SITE_URL + SITE_DIRECTORY, path);
    },
    getSitePath: function (path) {
        path = path || '';
        return url.resolve(SITE_DIRECTORY, path);
    }
};

module.exports = UrlService;
