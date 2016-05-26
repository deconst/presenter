'use strict';

const config = require('../../config');
const logger = require('../../server/logging').logger;
const UrlService = require('../url');
const RevisionService = require('../revision');

var contentMap = {};

const ContentRoutingService = {
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
      contentID = RevisionService.applyToContentID(context.revisionID, contentID);
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

  // Return an array containing mapping objects for each occurrence of a content ID within the
  // content map. An empty array will be returned if the content ID is not mapped anywhere.
  //
  // options.domain - Only search the content map for this domain. Default: search all domains.
  // options.onlyFirst - Only return the first mapping (as a one-element array). Default: return
  //   all mappings.
  // options.stagingOutput - If contentID is interpreted as a staging ID with a revision ID
  //   segment, report the staging presented URL rather than the non-staging one. Default: return
  //   staging URLs.
  //
  // Mapping objects contain:
  // mapping.domain - Domain at which the content ID was matched.
  // mapping.path - The full presented path to the content with the requested ID.
  // mapping.baseContentID - Content ID base that successfully matched. This may be a prefix of the
  //   queried one.
  // mapping.basePath - Presented path prefix that was mapped. They may be a prefix of mapping.path.
  getMappingsForContentID: function (contentID, options) {
    options = Object.assign({
      domain: null,
      onlyFirst: false,
      stagingOutput: true
    }, options);

    let domainContentMaps = [];
    let revisionID = null;

    if (options.domain) {
      domainContentMaps = [{ domain: options.domain, map: getDomainContentMap(options.domain) }];
    } else {
      domainContentMaps = Object.keys(contentMap).map((domain) => {
        return { domain, map: getDomainContentMap(domain) };
      });
    }

    if (config.staging_mode()) {
      let results = RevisionService.fromContentID(contentID);
      revisionID = results.revisionID;
      contentID = results.contentID;

      logger.debug('Using content ID without revision to locate presented path', {
        revisionID, contentID
      });
    }

    let mappings = [];

    // Normalize the contentID with a trailing slash so that the .indexOf() and .replace() checks
    // work correctly.
    if (!contentID.endsWith('/')) {
      contentID = contentID + '/';
    }

    domainContentMaps.forEach((domainContent) => {
      for (let basePath in domainContent.map) {
        let baseContentID = domainContent.map[basePath];
        if (baseContentID === null) continue;

        // Normalize the baseContentID with a trailing slash as well.
        if (!baseContentID.endsWith('/')) {
          baseContentID = baseContentID + '/';
        }

        if (contentID.indexOf(baseContentID) !== -1) {
          let domain = domainContent.domain;
          let subPath = '/' + contentID.replace(baseContentID, '');

          if (config.staging_mode() && options.stagingOutput) {
            baseContentID = RevisionService.applyToContentID(revisionID, baseContentID);
            basePath = RevisionService.applyToPath(revisionID, domain, basePath);
            if (config.presented_url_domain() && domain !== config.presented_url_domain()) {
              domain = config.presented_url_domain();
            }
          }

          let sitePath = '/' + slashJoin([basePath, subPath]);
          if (!sitePath.endsWith('/')) sitePath += '/';

          mappings.push({
            domain,
            baseContentID,
            basePath,
            path: sitePath
          });

          if (options.onlyFirst) break;
        }
      }
    });

    return mappings;
  },

  getPresentedUrl: function (context, contentID, nonStagingURL) {
    const options = {
      onlyFirst: true,
      stagingOutput: !nonStagingURL
    };

    let urls = this.getMappingsForContentID(contentID, options).map((mapping) => {
      return UrlService.getSiteUrl(context, mapping.path, mapping.domain);
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
  return strings.map((each) => {
    return each.replace(/^\/+/, '').replace(/\/+$/, '');
  }).filter((each) => {
    return each !== '';
  }).join('/');
};
