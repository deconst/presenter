var async = require('async');
var fs = require('fs');
var globby = require('globby');
var path = require('path');
var logger = require('../server/logging').logger;
var services = {
    nunjucks: require('./nunjucks'),
    path: require('./path'),
};
var ResponseHelper = require('../helpers/response');
var HttpErrorHelper = require('../helpers/http-error');

var TemplateService = {
    render: function (templatePath, data) {
        var templateFile = this._findTemplate(templatePath);
        var templateData = this._bootstrapContext(data);

        try {
            var output = services.nunjucks.render(templateFile, templateData);
            ResponseHelper.send(output);
        }
        catch (e) {
            logger.error(e);
            this.render('500');
        }

    },
    _bootstrapContext: function (content) {
        return {
            deconst: {
                env: process.env,
                content: content || {},
                url: require('./url'),
                request: require('../helpers/request'),
                response: require('../helpers/response')
            }
        };
    },
    _findTemplate: function (templatePath) {
        templatePath = templatePath || 'index';
        var templateDir = services.path.getTemplatesPath();
        var defaultTemplateDir = services.path.getDefaultTemplatesPath();
        var templateBase = path.resolve(templateDir, templatePath);
        var defaultTemplateBase = path.resolve(defaultTemplateDir, templatePath);

        var matches = globby.sync([
            templateBase,
            templateBase + '.html',
            templateBase + '.htm',
            templateBase + '/index.html',
            templateBase + '/index.htm',
            defaultTemplateBase,
            defaultTemplateBase + '.html',
            defaultTemplateBase + '.htm',
            defaultTemplateBase + '/index.html',
            defaultTemplateBase + '/index.htm',
        ]);

        if(matches.length === 0) {
            return '404.html';
        }

        return matches[0].replace(templateDir + '/', '').replace(defaultTemplateDir + '/', '');
    }
};

module.exports = TemplateService;
