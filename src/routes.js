// Dispatch requests to handlers.

content = require('./content');

exports.install = function (app) {
  app.get('/*', content);
}
