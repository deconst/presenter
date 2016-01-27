var url = require('url');

var config = require('../config');

var rewriteMap = {};

var RewriteService = {
  setRewriteMap: function (configMap) {
    var compileRx = function (rule) {
      rule.from = new RegExp(rule.from, 'g');
    };

    for (var domain in configMap) {
      Array.prototype.forEach.call(configMap[domain].rewrites, compileRx);
    }

    rewriteMap = configMap;
  },
  getRewrite: function (req) {
    var domain = config.presented_url_domain() || req.get('Host');
    var rewrites = rewriteMap[domain].rewrites || [];

    for (var i = 0; i < rewrites.length; i++) {
      var rule = rewrites[i];

      var originalURL = req.url;
      var parsedURL = url.parse(originalURL, true);
      var isRewrite = rule.rewrite || false;
      var status = rule.status || 301;

      // If the pathname doesn't match the "from" pattern, get the
      // heck outta here!
      if (!rule.from.test(parsedURL.pathname)) {
        continue;
      }

      // If the incoming URL's pathname matches the pattern, replace
      // it with the rule's "to" pattern
      parsedURL.pathname = parsedURL.pathname.replace(rule.from, rule.to);

      // Set hostname and port independently.
      delete parsedURL.host;

      // Replace the host, protocol, and port only if configured to do so.
      if (rule.toProtocol !== undefined) {
        parsedURL.protocol = rule.toProtocol;
      }
      if (rule.toHostname !== undefined) {
        parsedURL.hostname = rule.toHostname;
      }
      if (rule.toPort !== undefined) {
        parsedURL.port = rule.toPort;
      }

      var toURL = url.format(parsedURL);

      // Stop processing and redirect if this isn't a rewrite
      if (isRewrite) {
        return {
          redirect: false,
          toURL: toURL
        };
      } else {
        return {
          redirect: true,
          status: status,
          toURL: toURL
        };
      }
    }

    return null;
  }
};

module.exports = RewriteService;
