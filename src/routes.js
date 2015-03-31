// Dispatch requests to handlers.

version = require('./version');
content = require('./content');

exports.install = function (app) {
  app.get('/version', version);
  app.get('/*', content);
};
