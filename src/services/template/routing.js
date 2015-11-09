var logger = require('../../server/logging').logger;

var templateMap = {};

var getDomainTemplateMap = function (domain) {
  if (!templateMap.hasOwnProperty(domain) || !templateMap[domain].hasOwnProperty('routes')) {
    logger.warn('Template map has no template routes defined for this domain.', {
      domain: domain
    });
    return {};
  }

  return templateMap[domain].routes;
};

var TemplateRoutingService = {
  setTemplateMap: function (map) {
    templateMap = map;
  },
  getRoute: function (context) {
    var urlPath = context.request.path;
    var domainTemplateMap = getDomainTemplateMap(context.host());
    var bestMatch = null;

    for (var pattern in domainTemplateMap) {
      var patternExpression = new RegExp(pattern);
      if (patternExpression.test(urlPath)) {
        bestMatch = domainTemplateMap[pattern];
      }
    }

    bestMatch = bestMatch || 'index.html';
    context.templatePath = bestMatch;
    return bestMatch;
  }
};

module.exports = TemplateRoutingService;
