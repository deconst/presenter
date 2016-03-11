'use strict';
// Dispatch requests to handlers.

const version = require('./version');
const content = require('./content');
const crash = require('./crash');
const mappings = require('./mappings');
const robots = require('./robots');
const config = require('../config');

exports.install = function (app) {
  if (config.presenter_diagnostics()) {
    app.get('/crash', crash);
  }

  app.get('/version', version);
  app.get('/_api/whereis/:id', mappings.whereis);
  app.get('/robots.txt', robots);
  app.get('/*', content);
};
