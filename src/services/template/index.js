var globby = require('globby');
var path = require('path');
var logger = require('../../server/logging').logger;
var services = {
  content: require('../content'),
  nunjucks: require('../nunjucks'),
  path: require('../path'),
  url: require('../url')
};

var TemplateService = {
  render: function (context, templatePath, data, callback) {
    var templateFile = this._findTemplate(context, templatePath);

    this._bootstrapContext(context, data, function (err, templateData) {
      if (err) {
        return callback(err);
      }

      var startTimestamp = Date.now();

      services.nunjucks.getEnvironment(context, function (err, env) {
        if (err) {
          logger.error(err);
        }

        env.render(templateFile, templateData, function (err, result) {
          context.templateRenderDuration = Date.now() - startTimestamp;

          callback(err, result);
        });
      });
    });
  },
  _bootstrapContext: function (context, content, callback) {
    var ctx = {
      deconst: {
        env: process.env,
        content: content || {},
        url: services.url,
        context: context,
        request: context.request,
        response: context.response
      }
    };

    services.content.getAssets(context, function (err, data) {
      if (err) {
        ctx.deconst.assets = {};
      } else {
        ctx.deconst.assets = data;
      }
      callback(null, ctx);
    });
  },
  _findTemplate: function (context, templatePath) {
    templatePath = templatePath || 'index';

    var defaultTemplateDir = services.path.getDefaultTemplatesPath();
    var defaultTemplateBase = path.resolve(defaultTemplateDir, templatePath);

    var possibilities = [
      defaultTemplateBase,
      defaultTemplateBase + '.html',
      defaultTemplateBase + '.htm',
      defaultTemplateBase + '/index.html',
      defaultTemplateBase + '/index.htm'
    ];

    var templateDir = null;
    if (context.host()) {
      templateDir = services.path.getTemplatesPath(context.host());
      var templateBase = path.resolve(templateDir, templatePath);

      possibilities = possibilities.concat([
        templateBase,
        templateBase + '.html',
        templateBase + '.htm',
        templateBase + '/index.html',
        templateBase + '/index.htm'
      ]);
    }

    var matches = globby.sync(possibilities);

    if (matches.length === 0 && templatePath !== '404.html') {
      return this._findTemplate(context, '404.html');
    }

    if (matches.length === 0) {
      throw new Error('Unable to find static 404 handler');
    }

    var m = matches[0].replace(defaultTemplateDir + '/', '');
    if (templateDir) {
      m = m.replace(templateDir + '/', '');
    }
    return m;
  }
};

module.exports = TemplateService;
