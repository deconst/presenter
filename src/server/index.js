/*
 * Create and configure an Express server to host the application.
 */

var
  express = require('express'),
  logging = require('./logging'),
  proxies = require('./proxies'),
  rewrites = require('./rewrites'),
  routes = require('../routers'),
  path = require('path'),
  pathService = require('../services/path');

exports.create = function () {
  var app = express();

  var staticPath = path.resolve(pathService.getControlRepoPath(), 'assets');

  app.use(logging.requestLogger());
  app.use('/assets', express.static(staticPath));

  proxies(app);
  rewrites(app);
  routes.install(app);

  return app;
};
