/*
* app.js: Entry point for the presenter
*
* (C) 2015 Rackspace, Inc.
*
*/

var config = require('./src/config');

config.configure(process.env);

var
  express = require('express'),
  logging = require('./src/logging'),
  routes = require('./src/routes');

var
  app = express(),
  logger = logging.getLogger();

app.use(logging.requestLogger());

routes.install(app);

var server = app.listen(8080, function() {
  logger.info('Presenter listening at http://%s:%s', server.address().address, server.address().port);
});
