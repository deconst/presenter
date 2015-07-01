var async = require('async');
var fs = require('fs');
var globby = require('globby');
var path = require('path');
var services = {
    nunjucks: require('./nunjucks'),
    path: require('./path')
};

var TemplateService = {
    render: function (templatePath, data) {
        var templateFile = this._findTemplate(templatePath);
        try {
            return services.nunjucks.render(templateFile, data);
        }
        catch (e) {
            console.log(e);
            return e;
        }

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
