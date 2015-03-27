/*
* app.js: Entry point for the presenter
*
* (C) 2015 Rackspace, Inc.
*
*/

var
  express = require('express'),
  logging = require('./src/logging'),
  exphbs = require('express-handlebars'),
  config = require('./src/config'),
  routes = require('./src/routes');

config.configure(process.env);

var app = express();

app.engine('handlebars', exphbs());
app.set('view engine', 'handlebars');
app.use(logging.requestLogger());

routes.install(app);

var server = app.listen(8080, function() {
  logging.getLogger().info('Presenter listening at http://%s:%s', server.address().address, server.address().port);
});
