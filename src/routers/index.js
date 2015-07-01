// Dispatch requests to handlers.

var version = require('./version');
var content = require('./content');
var RequestHelper = require('../helpers/request');
var ResponseHelper = require('../helpers/response');

exports.install = function (app) {
    app.use(function (req, res, next) {
        RequestHelper.request = req;
        ResponseHelper.response = res;

        next();
    });

    app.get('/version', version);
    app.get('/*', content);
};
