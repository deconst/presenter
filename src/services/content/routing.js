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
  getMappingsForContentID: function (contentID, domain, onlyFirst) {
    let domainContentMaps = [];

    if (domain) {
      domainContentMaps = [{ domain, map: getDomainContentMap(domain) }];
    } else {
      domainContentMaps = Object.keys(contentMap).map((domain) => {
        return { domain, map: getDomainContentMap(domain) };
      });
    }

    let mappings = [];

    domainContentMaps.forEach((domainContent) => {
      for (let basePath in domainContent.map) {
        let baseContentID = domainContent.map[basePath];
        if (baseContentID === null) continue;
        baseContentID = baseContentID.replace(/\/$/, '');

        if (contentID.indexOf(baseContentID) !== -1) {
          let subPath = contentID.replace(baseContentID, '');

          mappings.push({
            domain: domainContent.domain,
            baseContentID,
            basePath,
            subPath
          });

          if (onlyFirst) break;
        }
      }
    });

    return mappings;
  },
  getPresentedUrl: function (context, contentID, crossDomain) {
    let domain = null;
    let onlyFirst = false;

    if (!crossDomain) {
      domain = context.host();
      onlyFirst = true;
    }

    let urls = this.getMappingsForContentID(contentID, domain, onlyFirst).map((mapping) => {
      let path = url.resolve(mapping.basePath, mapping.subPath);
      return UrlService.getSiteUrl(context, path, mapping.domain);
    });

    if (urls.length === 0) return null;

    return urls[0];
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
