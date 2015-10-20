/*
 * Create and configure an Express server to host the application.
 */

var express = require('express');
var logging = require('./logging');
var proxies = require('./proxies');
var rewrites = require('./rewrites');
var routes = require('../routers');
var path = require('path');
var pathService = require('../services/path');

exports.create = function () {
  var app = express();

  var staticPath = path.resolve(pathService.getControlRepoPath(), 'assets');
  app.use('/assets', express.static(staticPath));

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
