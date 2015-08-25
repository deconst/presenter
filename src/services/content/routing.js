var fs = require('fs');
var path = require('path');
var url = require('url');
var config = require('../../config');
var logger = require('../../server/logging').logger;
var PathService = require('../path');
var UrlService = require('../url');

var CONTENT_FILE = config.control_content_file();

var ContentRoutingService = {
  _readContentConfig: function () {
    try {
      return JSON.parse(fs.readFileSync(
        path.resolve(PathService.getConfigPath(), CONTENT_FILE),
        'utf-8'
      ));
    } catch (e) {
      logger.error('Unable to read ' + path.resolve(PathService.getConfigPath(), CONTENT_FILE));
      return {};
    }
  },
  _readContent: function (site) {
    var contentConfig = this._readContentConfig();

    if (!contentConfig.hasOwnProperty(site) || !contentConfig[site].hasOwnProperty('content')) {
      logger.warn(CONTENT_FILE + ' has no content routes defined for this site.');
      return {};
    }

    return contentConfig[site].content;
  },
  _readProxies: function (site) {
    var contentConfig = this._readContentConfig();

    if (!contentConfig.hasOwnProperty(site) || !contentConfig[site].hasOwnProperty('proxy')) {
      return {};
    }

    return contentConfig[site].proxy;
  },
  getContentId: function (context, urlPath) {
    urlPath = urlPath || context.request.path;
    var content = this._readContent(context.host());

    var contentStoreBase = null, afterPrefix = null;

    for (var prefix in content) {
      if (urlPath.indexOf(prefix) !== -1) {
        contentStoreBase = content[prefix];
        afterPrefix = urlPath.replace(prefix, '');
      }
    }

    if (contentStoreBase === null) {
      return null;
    }

    return url.resolve(contentStoreBase, afterPrefix).replace(/\/$/, '');
  },
  getContentPrefix: function (context) {
    var urlPath = context.request.path;
    var content = this._readContent(context.host());

    var prefixMatch = null;

    for (var prefix in content) {
      if (urlPath.indexOf(prefix) !== -1) {
        prefixMatch = prefix;
      }
    }

    return prefixMatch;
  },
  getPresentedUrl: function (context, contentId) {
    var content = this._readContent(context.host()),
      urlBase = null,
      afterPrefix = null;

    for (var prefix in content) {
      if (contentId.indexOf(content[prefix].replace(/\/$/, '')) !== -1) {
        urlBase = prefix;
        afterPrefix = contentId.replace(content[prefix], '');
      }
    }

    return UrlService.getSiteUrl(context, url.resolve(urlBase, afterPrefix));
  },
  getProxies: function (context) {
    return this._readProxies(context.host());
  },
  getAllProxies: function () {
    var proxies = [];

    var contentConfig = this._readContentConfig();

    for (var site in contentConfig) {
      var siteConfig = contentConfig[site];
      if (siteConfig.hasOwnProperty('proxy')) {
        proxies.push({
          site: site,
          proxy: siteConfig.proxy
        });
      }
    }

    return proxies;
  }
};

module.exports = ContentRoutingService;
