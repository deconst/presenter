var url = require('url');
var logger = require('../../server/logging').logger;
var UrlService = require('../url');

var contentMap = {};

var getDomainContentMap = function (domain) {
  if (!contentMap.hasOwnProperty(domain) || !contentMap[domain].hasOwnProperty('content')) {
    logger.warn('Content map has no content routes defined for this domain.', {
      domain: domain
    });
    return {};
  }

  return contentMap[domain].content;
};

var getDomainProxyMap = function (domain) {
  if (!contentMap.hasOwnProperty(domain) || !contentMap[domain].hasOwnProperty('proxy')) {
    return {};
  }

  return contentMap[domain].proxy;
};

var ContentRoutingService = {
  setContentMap: function (map) {
    contentMap = map;
  },
  getContentId: function (context, urlPath) {
    urlPath = urlPath || context.request.path;
    var domainContentMap = getDomainContentMap(context.host());

    var contentStoreBase = null;
    var afterPrefix = null;

    for (var prefix in domainContentMap) {
      if (urlPath.indexOf(prefix) !== -1) {
        contentStoreBase = domainContentMap[prefix];
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
    var domainContentMap = getDomainContentMap(context.host());

    var prefixMatch = null;

    for (var prefix in domainContentMap) {
      if (urlPath.indexOf(prefix) !== -1) {
        prefixMatch = prefix;
      }
    }

    return prefixMatch;
  },
  getPresentedUrl: function (context, contentId) {
    var domainContentMaps = [];

    if (context) {
      domainContentMaps.push(getDomainContentMap(context.host()));
    } else {
      domainContentMaps = Object.keys(contentMap);
    }

    var urlBase = null;
    var afterPrefix = null;

    domainContentMaps.forEach(function (domainContentMap) {
      for (var prefix in domainContentMap) {
        if (contentId.indexOf(domainContentMap[prefix].replace(/\/$/, '')) !== -1) {
          urlBase = prefix;
          afterPrefix = contentId.replace(domainContentMap[prefix], '');
          break;
        }
      }
    });

    if (urlBase !== null && afterPrefix !== null) {
      return UrlService.getSiteUrl(context, url.resolve(urlBase, afterPrefix));
    } else {
      return null;
    }
  },
  getProxies: function (context) {
    return getDomainProxyMap(context.host());
  },
  getAllProxies: function () {
    var proxies = [];

    for (var site in contentMap) {
      var siteConfig = contentMap[site];
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
