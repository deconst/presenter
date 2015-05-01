/*
* app.js: Entry point for the presenter
*
* (C) 2015 Rackspace, Inc.
*
*/

var config = require('./src/config');

config.configure(process.env);

var server = require('./src/server').create();

server.listen(8080, function() {
  logger.info('Presenter listening at http://%s:%s', server.address().address, server.address().port);
});
