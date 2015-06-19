var fs = require('fs');
var path = require('path');
var url = require('url');
var RequestHelper = require('../helpers/request');
var PathService = require('../services/path');

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

        // return url.resolve(contentStoreBase, afterPrefix).replace(/\/$/, '');
    }
};

module.exports = ContentRoutingService;
