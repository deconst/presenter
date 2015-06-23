var fs = require('fs');
var path = require('path');
var url = require('url');
var RequestHelper = require('../../helpers/request');
var PathService = require('../path');
var UrlService = require('../url');

var CONTENT_FILE = 'content.json';
var SITE_KEY = 'developer.rackspace.com';

var ContentRoutingService = {
    _readContent: function (site) {
        var content =
            JSON.parse(fs.readFileSync(
                path.resolve(PathService.getConfigPath(), CONTENT_FILE),
                'utf-8'
            ))[site];

        return content.content;
    },
    _readProxies: function (site) {
        var content =
            JSON.parse(fs.readFileSync(
                path.resolve(PathService.getConfigPath(), CONTENT_FILE),
                'utf-8'
            ))[site];

        return content.proxy;
    },
    getContentId: function (urlPath) {
        urlPath = urlPath || RequestHelper.request.path;
        var content = this._readContent(SITE_KEY);

        var contentStoreBase = null, afterPrefix = null;

        for(var prefix in content) {
            if(urlPath.indexOf(prefix) !== -1) {
                contentStoreBase = content[prefix];
                afterPrefix = urlPath.replace(prefix, '');
            }
        }

        if(contentStoreBase === null) {
            return null;
        }

        return url.resolve(contentStoreBase, afterPrefix).replace(/\/$/, '');
    },
    getContentPrefix: function (urlPath) {
        urlPath = urlPath || RequestHelper.request.path;
        var content = this._readContent(SITE_KEY);

        var prefixMatch = null;

        for(var prefix in content) {
            if(urlPath.indexOf(prefix) !== -1) {
                prefixMatch = prefix;
            }
        }

        return prefixMatch;
    },
    getPresentedUrl: function (contentId) {
        var content = this._readContent(SITE_KEY),
            urlBase = null,
            afterPrefix = null;

        // contentId = contentId.replace(/\/$/, '');

        for(var prefix in content) {
            if(contentId.indexOf(content[prefix].replace(/\/$/, '')) !== -1) {
                urlBase = prefix;
                afterPrefix = contentId.replace(content[prefix], '');
            }
        }

        return UrlService.getSiteUrl(url.resolve(urlBase, afterPrefix));
    },
    getProxies: function () {
        return this._readProxies(SITE_KEY);
    }
};

module.exports = ContentRoutingService;
