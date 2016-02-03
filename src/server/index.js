/*
 * Create and configure an Express server to host the application.
 */

var express = require('express');

var logging = require('./logging');
var proxies = require('./proxies');
var rewrites = require('./rewrites');
var routes = require('../routers');
var config = require('../config');

var PathService = require('../services/path');

exports.create = function () {
  var app = express();

  // Serve assets from the appropriate site in the control repo
  app.use('/assets', function (req, res, next) {
    var domain = config.presented_url_domain() || req.hostname;
    var assetsPath = PathService.getAssetPath(domain);

    return express.static(assetsPath).apply(this, arguments);
  });

  app.use(logging.requestLogger());
  app.set('trust proxy', true);

  proxies(app);
  rewrites(app);
  routes.install(app);

  app.use(function (err, req, res, next) {
    logging.logger.error({
      stack: err.stack,
      message: 'Express.js error handler invoked'
    });

    res.status(500).send('Something went wrong.');
  });

  return app;
};
