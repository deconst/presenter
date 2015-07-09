var events = require('events');
var logger = require('../server/logging').logger;
var ResponseHelper = require('./response');
var TemplateService = require('../services/template');


var EventEmitter = events.EventEmitter;
var HttpErrorHelper = new EventEmitter();


/**
 * @todo implement EventEmitter2 or similar to get wildcard event handlebars
 */

HttpErrorHelper.on('404', function (error) {
    error = error || {};

    ResponseHelper.status(404);
    TemplateService.render('404');
});

HttpErrorHelper.on('500', function (error) {
    error = error || {};

    if(!error.statusCode) {
        error.statusCode = 500;
    }

    ResponseHelper.status(error.statusCode);
    TemplateService.render('500');
});

module.exports = HttpErrorHelper;
