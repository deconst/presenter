/*
* app.js: Entry point for the presenter
*
* (C) 2015 Rackspace, Inc.
*
*/

var
  express = require('express'),
  exphbs  = require('express-handlebars'),
  config = require('./src/config'),
  routes = require('./src/routes');

config.configure();

var app = express();

app.engine('handlebars', exphbs());
app.set('view engine', 'handlebars');

routes.install(app);

app.listen(8080);
