'use strict';

const url = require('url');
const config = require('../config');

// Lazily loaded because of the circular dependency.
let ContentRoutingService = null;

let RevisionService = {
  fromPath: function (path) {
    if (!ContentRoutingService) {
      ContentRoutingService = require('./content/routing');
    }

    let stagingHost = null;
    let stagingPresentedPath = null;
    let revisionID = null;

    let parts = path.split('/');
    while (parts[0] === '') {
      parts.shift();
    }

    let first = parts.shift();
    if (ContentRoutingService.isKnownDomain(first)) {
      stagingHost = first;
      revisionID = parts.shift();
    } else {
      stagingHost = config.presented_url_domain();
      revisionID = first;
    }
    stagingPresentedPath = '/' + parts.join('/');

    return { revisionID, stagingHost, stagingPresentedPath };
  },
  fromContentID: function (contentID) {
    let u = url.parse(contentID);

    let parts = u.pathname.split('/');
    while (parts[0] === '') {
      parts.shift();
    }

    let revisionID = parts.shift();
    u.pathname = '/' + parts.join('/');
    contentID = url.format(u);

    return { revisionID, contentID };
  },
  applyToPath: function (revisionID, path) {
    let pathSegments = path.split('/');
    while (pathSegments[0] === '') {
      pathSegments.shift();
    }
    pathSegments.unshift(revisionID);
    return '/' + pathSegments.join('/');
  },
  applyToContentID: function (revisionID, contentID) {
    let u = url.parse(contentID);
    u.pathname = this.applyToPath(revisionID, u.pathname);
    return url.format(u);
  }
};

module.exports = RevisionService;
