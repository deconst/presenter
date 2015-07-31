var async = require('async');
var fs = require('fs');
var globby = require('globby');
var path = require('path');
var logger = require('../server/logging').logger;
var services = {
    content: require('./content'),
    nunjucks: require('./nunjucks'),
    path: require('./path'),
};
var HttpErrorHelper = require('../helpers/http-error');

var TemplateService = {
    render: function (context, templatePath, data) {
        var templateFile = this._findTemplate(templatePath);

        this._bootstrapContext(context, data, (function (templateData) {
            try {
                var output = services.nunjucks.render(templateFile, templateData);
                context.response.send(output);
            } catch (e) {
                logger.error(e);
                this.render('500');
            }
        }).bind(this));
    },
    _bootstrapContext: function (context, content, callback) {
        var ctx = {
            deconst: {
                env: process.env,
                content: content || {},
                url: require('./url'),
                request: context.request,
                response: context.response
            }
        };

        services.content.getAssets(function (err, data) {
            ctx.deconst.assets = data;
            callback(ctx);
        });
    },
    _findTemplate: function (context, templatePath) {
        templatePath = templatePath || 'index';
        var templateDir = services.path.getTemplatesPath(context);
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

        if (matches.length === 0) {
            return '404.html';
        }

        return matches[0].replace(templateDir + '/', '').replace(defaultTemplateDir + '/', '');
    }
};

module.exports = TemplateService;
