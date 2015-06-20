var events = require('events');
var ResponseHelper = require('./response');
var TemplateService = require('../services/template');

var EventEmitter = events.EventEmitter;
var HttpErrorHelper = new EventEmitter();

HttpErrorHelper.on('404', function (error) {
    var res = ResponseHelper.response;

    res.status(404).send(
        TemplateService.render('404')
    );
});

HttpErrorHelper.on('500', function (error) {
    var res = ResponseHelper.response;
    res.status(500).send(
        TemplateService.render('500')
    );
});

module.exports = HttpErrorHelper;
