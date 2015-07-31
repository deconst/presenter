var fs = require('fs');
var path = require('path');
var url = require('url');
var config = require('../config');
var PathService = require('../services/path');

var ROUTES_FILE = config.control_routes_file();

var TemplateRoutingService = {
    _readRoutes: function (site) {
        var routes =
            JSON.parse(fs.readFileSync(
                path.resolve(PathService.getConfigPath(), ROUTES_FILE),
                'utf-8'
            ))[site];

        return routes.routes;
    },
    getRoute: function (context) {
        var urlPath = context.request.path;
        var routes = this._readRoutes(context.host());
        var bestMatch = null;

        for (var pattern in routes) {
            var patternExpression = new RegExp(pattern);
            if (patternExpression.test(urlPath)) {
                bestMatch = routes[pattern];
            }
        }

        bestMatch = bestMatch || 'index.html';
        context.templatePath = bestMatch;
        return bestMatch;
    }
};

module.exports = TemplateRoutingService;
