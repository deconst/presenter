var url = require('url');

var SITE_DIRECTORY = '/';

var withTrailingSlash = function (u) {
  if (u[u.length - 1] === '/') {
    return u;
  }
  return u + '/';
};

var UrlService = {
  getSiteUrl: function (context, path, domain) {
    path = path || '';
    domain = domain || context.host();

    var siteUrl = context.protocol() + '://' + domain;

    return withTrailingSlash(url.resolve(siteUrl + SITE_DIRECTORY, path));
  },
  getSitePath: function (path) {
    path = path || '';
    return withTrailingSlash(url.resolve(SITE_DIRECTORY, path));
  }
};

module.exports = UrlService;
