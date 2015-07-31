var url = require('url');

var SITE_DIRECTORY = '/';

var UrlService = {
    getSiteUrl: function (context, path) {
        path = path || '';
        var siteUrl = context.protocol() + '://' + context.host();

        return url.resolve(siteUrl + SITE_DIRECTORY, path);
    },
    getSitePath: function (path) {
        path = path || '';
        return url.resolve(SITE_DIRECTORY, path);
    }
};

module.exports = UrlService;
