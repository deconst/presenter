var globby = require('globby');
var path = require('path');
var NunjucksService = require('../nunjucks');
var PathService = require('../path');
var UrlService = require('../url');

var TemplateService = {
  render: function (context, options, callback) {
    var templateFile = findTemplate(context, options.templatePath);
    var templateLocals = buildTemplateLocals(context, options.content, options.assets);
    var startTs = Date.now();

    NunjucksService.getEnvironment(context, function (err, env) {
      if (err) return callback(err);

      env.render(templateFile, templateLocals, function (err, result) {
        context.templateRenderDuration = Date.now() - startTs;

        callback(err, result);
      });
    });
  }
};

module.exports = TemplateService;

var buildTemplateLocals = function (context, content, assets) {
  if (assets) {
    // Some templates still use deconst.content.assets instead of deconst.assets
    content.assets = assets;
  }

  return {
    deconst: {
      env: process.env,
      content: content || {},
      assets: assets || {},
      url: UrlService,
      context: context,
      request: context.request,
      response: context.response
    }
  };
};

var findTemplate = function (context, templatePath) {
  templatePath = templatePath || 'index';

  var defaultTemplateDir = PathService.getDefaultTemplatesPath();
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
    templateDir = PathService.getTemplatesPath(context.host());
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
    return findTemplate(context, '404.html');
  }

  if (matches.length === 0) {
    throw new Error('Unable to find static 404 handler');
  }

  var m = matches[0].replace(defaultTemplateDir + '/', '');
  if (templateDir) {
    m = m.replace(templateDir + '/', '');
  }
  return m;
};
