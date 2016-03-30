'use strict';
// Dispatch requests to handlers.

const version = require('./version');
const content = require('./content');
const crash = require('./crash');
const api = require('./api');
const robots = require('./robots');
const config = require('../config');

exports.install = function (app) {
  if (config.presenter_diagnostics()) {
    app.get('/crash', crash);
  }

  const apiPath = config.presenter_api_path();

  app.get('/version', version);
  app.get(`/${apiPath}/whereis/:id`, api.whereis);
  app.get(`/${apiPath}/search`, api.search);
  app.get('/robots.txt', robots);
  app.get('/*', content);
};
