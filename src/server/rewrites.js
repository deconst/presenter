var url = require('url');
var logger = require('./logging').logger;
var RewriteService = require('../services/rewrite');

module.exports = function (app) {
  // System rewrites

  // Multiple slashes become a single slash.
  var emptySegment = /\/[\/]+/;
  app.use(function (req, res, next) {
    var parsedUrl = url.parse(req.url, true);

    if (emptySegment.test(parsedUrl.pathname)) {
      parsedUrl.pathname = parsedUrl.pathname.replace(emptySegment, '/');
      req.url = url.format(parsedUrl);
    }

    return next();
  });

  // User rewrites

  app.use(function (req, res, next) {
    var result = RewriteService.getRewrite(req);

    if (result && result.redirect) {
      logger.info('Redirected request', {
        fromURL: req.url,
        toURL: result.toURL,
        status: result.status
      });

      return res.redirect(result.status, decodeURIComponent(result.toURL));
    } else if (result && !result.redirect) {
      logger.debug('Rewrote request URL', {
        fromURL: req.url,
        toURL: result.toURL
      });

      req.url = result.toURL;
    }

    next();
  });
};
