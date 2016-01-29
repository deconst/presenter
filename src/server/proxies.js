var url = require('url');
var config = require('../config');
var ContentRoutingService = require('../services/content/routing');
var logger = require('./logging').logger;
var request = require('request');

function makeProxyRoute (site, path, target) {
  return function (req, res, next) {
    if(site) {
      var host = config.presented_url_domain() || req.get('Host');
      if (host !== site) {
        return next();
      }
    }

    var suffix = url.parse(req.originalUrl).path.replace(path, '');

    logger.debug('Proxy request: [' + target + suffix + '].');
    var proxyRequest = request(target + suffix);

    req.pipe(proxyRequest);
    proxyRequest.pipe(res);
  };
}

module.exports = function (app) {
  var proxies = ContentRoutingService.getAllProxies();

  // This __local_asset__ path is returned when the content service is memory-backed.
  // This little patch probably belongs over there, but I'm here right now so
  // this will do for now.
  // See also: https://github.com/deconst/content-service/issues/66
  app.use('/__local_asset__', makeProxyRoute(
    null,
    '__local_asset__/',
    url.resolve(config.content_service_url(), '/assets')
  ));

  proxies.forEach(function (each) {
    for (var path in each.proxy) {
      app.use(path + '*', makeProxyRoute(each.site, path, each.proxy[path]));
    }
  });
};
