/*
* app.js: Entry point for the presenter
*
* (C) 2015 Rackspace, Inc.
*
*/

var config = require('./src/config');

config.configure(process.env);

var logger = require('./src/server/logging').logger;

var ControlService = require('./src/services/control');

ControlService.update(null, function (ok) {
  if (!ok) {
    logger.error('Unable to perform initial control repository load');
    process.exit(1);
  }

  var app = require('./src/server').create();

  var server = app.listen(8080, function () {
    var host = server.address().address;
    var port = server.address().port;

    logger.info('Presenter listening at http://%s:%s', host, port);
  });
});
