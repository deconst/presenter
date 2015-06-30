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
    var res = ResponseHelper.response;

    if(res.headersSent) {
        return logger.warn('Trying to send error response but headers already sent.');
    }

    res.status(404).send(
        TemplateService.render('404', {
            deconst: {
                env: process.env
            }
        })
    );
});

HttpErrorHelper.on('500', function (error) {
    error = error || {};

    if(!error.statusCode) {
        error.statusCode = 500;
    }

    var res = ResponseHelper.response;

    if(res.headersSent) {
        return logger.warn('Trying to send error response but headers already sent.');
    }

    res.status(error.statusCode).send(
        TemplateService.render('500', {
            deconst: {
                env: process.env
            }
        })
    );
});

module.exports = HttpErrorHelper;
