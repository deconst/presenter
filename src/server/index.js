/*
 * Create and configure an Express server to host the application.
 */

var express = require('express'),
  logging = require('./logging'),
  proxies = require('./proxies'),
  rewrites = require('./rewrites'),
  routes = require('../routers'),
  path = require('path'),
  pathService = require('../services/path');

exports.create = function () {
  var app = express();

  var staticPath = path.resolve(pathService.getControlRepoPath(), 'assets');
  app.use('/assets', express.static(staticPath));

  app.use(logging.requestLogger());

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
