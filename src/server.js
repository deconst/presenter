/*
 * Create and configure an Express server to host the application.
 */

var
  express = require('express'),
  logging = require('./logging'),
  routes = require('./routes'),
  url = require('url');

exports.create = function () {
  var app = express();

  app.use(logging.requestLogger());

  app.use(function (req, res, next) {
      var trailingSlash = /\/$/;
      var fileExtension = /.+?\..+?$/;
      var parsedUrl = url.parse(req.url, true);

      if(trailingSlash.test(parsedUrl.pathname) || fileExtension.test(parsedUrl.pathname)) {
          return next();
      }

      res.redirect(301, parsedUrl.pathname + '/' + parsedUrl.search);
  });

  routes.install(app);

  return app;
};
