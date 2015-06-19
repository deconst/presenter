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
    app.get('/test', function (req, res) {
        var TemplateService = require('../services/template');
        var TemplateRoutingService = require('../services/template-routing');
        var ContentRoutingService = require('../services/content-routing');

        console.log(ContentRoutingService.getContentId());

        res.send(TemplateService.render(TemplateRoutingService.getRoute(), {foo: 'bar'}));
    });
    app.get('/*', content);
};
