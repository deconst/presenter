// Dispatch requests to handlers.

var version = require('./version');
var content = require('./content');
var crash = require('./crash');
var config = require('../config');

exports.install = function (app) {
    if (config.presenter_diagnostics()) {
        app.get('/crash', crash);
    }

    app.get('/version', version);
    app.get('/*', content);
};
