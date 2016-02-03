// Handler to assemble a specific piece of static content.

var async = require('async');
var logger = require('../server/logging').logger;
var Context = require('../helpers/context');
var TemplateService = require('../services/template');
var TemplateRoutingService = require('../services/template/routing');
var ContentService = require('../services/content');
var ContentRoutingService = require('../services/content/routing');
var ContentFilterService = require('../services/content/filter');
var UrlService = require('../services/url');
var ControlService = require('../services/control');

// Register content filters.

ContentFilterService.add(function (input, next) {
  var context = input.context;
  var content = input.content;

  // Match nunjucks-like "{{ to('') }}" directives that are used to defer rendering of presented URLs
  // until presenter-time.
  var urlDirectiveRx = /\{\{\s*to\('([^']+)'\)\s*\}\}/g;

  if (content.contentID && content.envelope) {
    // Replace any "{{ to() }}" directives with the appropriate presented URL.
    content.envelope.body = content.envelope.body.replace(
      urlDirectiveRx,
      function (match, contentID) {
        return ContentRoutingService.getPresentedUrl(context, contentID);
      }
    );
  }

  return next();
});

ContentFilterService.add(function (input, next) {
  var context = input.context;
  var content = input.content;

  // Locate the URLs for the content IDs of any next and previous links included in the
  // document.
  if (content.next && content.next.contentID && !content.next.url) {
    content.next.url = ContentRoutingService.getPresentedUrl(context, content.next.contentID);
  }

  if (content.previous && content.previous.contentID && !content.previous.url) {
    content.previous.url = ContentRoutingService.getPresentedUrl(context, content.previous.contentID);
  }

  return next();
});

module.exports = function (req, res) {
  var context = new Context(req, res);

  var contentId = ContentRoutingService.getContentId(context);
  var prefix = ContentRoutingService.getContentPrefix(context);
  var tocId = ContentRoutingService.getContentId(context,
    UrlService.getSitePath(prefix + '_toc')
  );

  context.contentId = contentId;

  // Note that each function returns errors as a .err attribute of its results object rather than
  // as the err parameter to its callback. This is so that all calls are guaranteed to complete
  // before the final callback is invoked, even if one or more produces an error, and assets will
  // be available.

  var capturedError = null;

  async.parallel({
    content: function (callback) {
      ContentService.get(context, contentId, {}, function (err, content) {
        if (err) {
          capturedError = err;
          return callback(null, null);
        }
        callback(null, content);
      });
    },
    assets: function (callback) {
      ContentService.getAssets(context, function (err, assetMap) {
        if (err) {
          // Fail gracefully.
          logger.warn('Unable to enumerate assets.', {
            errMessage: err.message,
            stack: err.stack
          });

          return callback(null, {});
        }

        context.setAssets(assetMap);
        callback(null, assetMap);
      });
    },
    toc: function (callback) {
      ContentService.get(context, tocId, {ignoreErrors: true}, function (err, toc) {
        if (err || !toc) {
          return callback(null, null);
        }

        var relativeUrls = /href=("|')(..\/)?([^\/].*?)("|')/g;
        toc.envelope.body =
          toc.envelope.body.replace(
            relativeUrls,
            'href=$1' + prefix + '$3$4'
        );

        return callback(null, toc.envelope.body);
      });
    },
    // control: function (callback) {
    //   ContentService.getControlSHA(context, function (err, sha) {
    //     if (err) return callback(err);
    //
    //     // No need to hold up the current request for the control repository update.
    //     // Kick it off here but don't wait for it to complete.
    //     if (sha && sha !== ControlService.getControlSHA()) {
    //       ControlService.update(sha);
    //     }
    //
    //     callback(null, sha);
    //   });
    // }
  }, function (err, output) {
    if (err || capturedError) {
      return context.handleError(err || capturedError);
    }

    if (output.toc) {
      output.content.globals = {
        toc: output.toc
      };
    }

    var input = {
      context: context,
      content: output.content
    };

    ContentFilterService.filter(input, function (err, filterResult) {
      if (err) return context.handleError(err);

      var options = {
        templatePath: TemplateRoutingService.getRoute(context),
        content: filterResult.content,
        assets: output.assets
      };

      TemplateService.render(context, options, function (err, renderedContent) {
        if (err) {
          return context.handleError(err);
        }

        context.send(renderedContent);
      });
    });
  });
};
