var url = require('url');
var ContentRoutingService = require('./services/content/routing');
var logger = require('./logging').logger;
var proxy = require('express-http-proxy');
var request = require('request');


module.exports = function (app) {
    var proxies = ContentRoutingService.getProxies();

    // By necessity, we're making functions within a loop
    // jshint -W083
    for(var path in proxies) {
        app.use(path + '*', function (req, res, next) {

            var suffix = url.parse(req.originalUrl).path.replace(path, '');

            logger.debug("Proxy request: [" + proxies[path] + suffix + "].");
            var proxyRequest = request(proxies[path] + suffix);

            req.pipe(proxyRequest);
            proxyRequest.pipe(res);
        });
    }
};
