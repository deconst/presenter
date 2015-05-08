/*
 * Create and configure an Express server to host the application.
 */

var
  express = require('express'),
  logging = require('./logging'),
  routes = require('./routes');

exports.create = function () {
  var app = express();

  app.use(logging.requestLogger());

  routes.install(app);

  return app;
};
