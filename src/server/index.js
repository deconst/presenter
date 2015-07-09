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
  pathService = require('../services/path'),
  RequestHelper = require('../helpers/request'),
  ResponseHelper = require('../helpers/response');

exports.create = function () {
  var app = express();

  var staticPath = path.resolve(pathService.getControlRepoPath(), 'assets');
  app.use('/assets', express.static(staticPath));

  app.use(function (req, res, next) {
      RequestHelper.request = req;
      ResponseHelper.response = res;

      next();
  });

  app.use(logging.requestLogger());

  proxies(app);
  rewrites(app);
  routes.install(app);

  return app;
};
