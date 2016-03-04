'use strict';

const url = require('url');
const config = require('../../config');
const logger = require('../../server/logging').logger;
const UrlService = require('../url');

var contentMap = {};

var ContentRoutingService = {
  // Sentinel objects to return from getContentId
  UNMAPPED: {
    toString: function () {
      return '[unmapped]';
    }
  },
  EMPTY_ENVELOPE: {
    toString: function () {
      return '[empty]';
    }
  },

  setContentMap: function (map) {
    contentMap = map;
  },
  isKnownDomain: function (domain) {
    return contentMap[domain] !== undefined;
  },
  getContentId: function (context, urlPath) {
    urlPath = urlPath || context.presentedPath();
    var domainContentMap = getDomainContentMap(context.host());

    var found = false;
    var contentIDBase = null;
    var afterPrefix = null;
    var prefixLength = 0;

    for (var prefix in domainContentMap) {
      if (urlPath.indexOf(prefix) === 0 && prefix.length > prefixLength) {
        found = true;
        prefixLength = prefix.length;
        contentIDBase = domainContentMap[prefix];
        afterPrefix = urlPath.replace(prefix, '');
      }
    }

    if (!found) {
      return this.UNMAPPED;
    }

    if (contentIDBase === null) {
      return /^\/?$/.test(afterPrefix) ? this.EMPTY_ENVELOPE : this.UNMAPPED;
    }

    let contentID = slashJoin([contentIDBase, afterPrefix]);

    // In staging mode, prepend a path segment with the revision ID into the content ID.
    if (config.staging_mode()) {
      let u = url.parse(contentID);
      let pathSegments = u.pathname.split('/');
      while (pathSegments[0] === '') {
        pathSegments.shift();
      }
      pathSegments.unshift(context.revisionID);
      u.pathname = pathSegments.join('/');

      contentID = url.format(u);
    }

    return contentID;
  },
  getContentPrefix: function (context) {
    var urlPath = context.presentedPath();
    var domainContentMap = getDomainContentMap(context.host());

    var prefixMatch = null;

    for (var prefix in domainContentMap) {
      if (urlPath.indexOf(prefix) !== -1) {
        prefixMatch = prefix;
      }
    }

    return prefixMatch;
  },
  getPresentedUrl: function (context, contentId, crossDomain) {
    var domainContentMaps = {};

    if (crossDomain) {
      domainContentMaps = Object.keys(contentMap).map(function (k) {
        return {
          domain: k,
          map: getDomainContentMap(k)
        };
      });
    } else {
      domainContentMaps.push({
        domain: context.host(),
        map: getDomainContentMap(context.host())
      });
    }

    var urlDomain = null;
    var urlBase = null;
    var afterPrefix = null;

    domainContentMaps.forEach(function (domainContent) {
      if (urlDomain !== null && urlBase !== null && afterPrefix !== null) {
        return;
      }

      for (var prefix in domainContent.map) {
        var contentIdBase = domainContent.map[prefix];
        if (contentIdBase === null) continue;
        contentIdBase = contentIdBase.replace(/\/$/, '');

        if (contentId.indexOf(contentIdBase) !== -1) {
          urlDomain = domainContent.domain;
          urlBase = prefix;
          afterPrefix = contentId.replace(contentIdBase, '');
          break;
        }
      }
    });

    if (urlDomain !== null && urlBase !== null && afterPrefix !== null) {
      return UrlService.getSiteUrl(context, url.resolve(urlBase, afterPrefix), urlDomain);
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

const getDomainContentMap = function (domain) {
  if (!contentMap.hasOwnProperty(domain) || !contentMap[domain].hasOwnProperty('content')) {
    logger.warn('Content map has no content routes defined for this domain.', {
      domain: domain
    });
    return {};
  }

  return contentMap[domain].content;
};

const getDomainProxyMap = function (domain) {
  if (!contentMap.hasOwnProperty(domain) || !contentMap[domain].hasOwnProperty('proxy')) {
    return {};
  }

  return contentMap[domain].proxy;
};

const slashJoin = function (strings) {
  return strings.map(function (each) {
    return each.replace(/^\/+/, '').replace(/\/+$/, '');
  }).filter(function (each) {
    return each !== '';
  }).join('/');
};
