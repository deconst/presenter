// Dispatch requests to handlers.

var version = require('./version');
var content = require('./content');
var crash = require('./crash');
var RequestHelper = require('../helpers/request');
var ResponseHelper = require('../helpers/response');
var config = require('../config');

exports.install = function (app) {
    app.use(function (req, res, next) {
        RequestHelper.request = req;
        ResponseHelper.response = res;

        next();
    });

    if(config.presenter_diagnostics()) {
        app.get('/crash', crash);
    }

    app.get('/version', version);
    app.get('/*', content);
};
