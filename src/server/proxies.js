var url = require('url');
var config = require('../config');
var ContentRoutingService = require('../services/content/routing');
var logger = require('./logging').logger;
var request = require('request');

function makeProxyRoute(site, path) {
    return function (req, res, next) {
        var host = config.presented_url_domain() || req.get('Host');
        if (host !== site) {
            return next();
        }

        var suffix = url.parse(req.originalUrl).path.replace(path, '');

        logger.debug("Proxy request: [" + proxies[path] + suffix + "].");
        var proxyRequest = request(proxies[path] + suffix);

        req.pipe(proxyRequest);
        proxyRequest.pipe(res);
    };
}

module.exports = function (app) {
    var proxies = ContentRoutingService.getAllProxies();

    for(var each in proxies) {
        for (var path in each.proxy) {
            app.use(path + '*', makeProxyRoute(proxy.site, path));
        }
    }
};
