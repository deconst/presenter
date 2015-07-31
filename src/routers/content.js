// Handler to assemble a specific piece of static content.

var
    fs = require('fs'),
    path = require('path'),
    request = require('request'),
    url = require('url'),
    urljoin = require('url-join'),
    async = require('async'),
    handlebars = require('handlebars'),
    _ = require('lodash'),
    config = require('../config'),
    logger = require('../server/logging').logger,
    TemplateService = require('../services/template'),
    TemplateRoutingService = require('../services/template-routing'),
    ContentService = require('../services/content'),
    ContentRoutingService = require('../services/content/routing'),
    ContentFilterService = require('../services/content/filter'),
    UrlService = require('../services/url'),
    HttpErrorHelper = require('../helpers/http-error');

var handleError = function (error) {
    logger.error(error);

    if(error.statusCode && error.statusCode.toString() === '404') {
        return HttpErrorHelper.emit(error.statusCode.toString(), error);
    }

    return HttpErrorHelper.emit('500', error);
};

// Register content filters.

ContentFilterService.add(function (content, next) {
    // Match nunjucks-like "{{ to('') }}" directives that are used to defer rendering of presented URLs
    // until presenter-time.
    var urlDirectiveRx = /\{\{\s*to\('([^']+)'\)\s*\}\}/g;

    if (content.contentID && content.envelope) {
        // Replace any "{{ to() }}" directives with the appropriate presented URL.
        content.envelope.body = content.envelope.body.replace(
            urlDirectiveRx,
            function (match, contentID) {
                return ContentRoutingService.getPresentedUrl(contentID);
            }
        );
    }

    return next();
});

ContentFilterService.add(function (content, next) {
    // Locate the URLs for the content IDs of any next and previous links included in the
    // document.
    if (content.next && content.next.contentID && ! content.next.url) {
        content.next.url = ContentRoutingService.getPresentedUrl(content.next.contentID);
    }

    if (content.previous && content.previous.contentID && ! content.previous.url) {
        content.previous.url = ContentRoutingService.getPresentedUrl(content.previous.contentID);
    }

    return next();
});

module.exports = function (req, res) {
    var contentId = ContentRoutingService.getContentId();
    var prefix = ContentRoutingService.getContentPrefix();
    var tocId = ContentRoutingService.getContentId(
        UrlService.getSitePath(prefix + '_toc')
    );

    async.parallel({
        content: function (callback) {
            ContentService.get(contentId, {}, callback);
        },
        toc: function (callback) {
            ContentService.get(tocId, {ignoreErrors: true}, function (err, toc) {
                if(!toc) {
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
    }, function (err, output) {
        if(err) {
            return handleError(err);
        }
        if(output.toc) {
            output.content.globals = {
                toc: output.toc
            };
        }

        ContentFilterService.filter(output.content, function (error, filteredContent) {
            if(error) {
                return HttpErrorHelper.emit('500');
            }

            TemplateService.render(TemplateRoutingService.getRoute(), filteredContent);
        });
    });
};
