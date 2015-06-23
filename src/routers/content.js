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
  logger = require('../logging').logger,
  TemplateService = require('../services/template'),
  TemplateRoutingService = require('../services/template-routing'),
  ContentRoutingService = require('../services/content/routing'),
  ContentFilterService = require('../services/content/filter'),
  UrlService = require('../services/url'),
  HttpErrorHelper = require('../helpers/http-error');

// Create an Error object with the provided message and a custom attribute that remembers the
// (presumably non-200) status code of the associated HTTP response.
function response_error(res, message) {
var err = new Error(message);
err.statusCode = res.statusCode;

if (err.statusCode === 404) {
  err.statusMessage = "Required resource not found";
} else {
  err.statusMessage = "Upstream server error";
}

return err;
}

function content_error(target, caller) {
return new Error("Unknown content ID type [" + JSON.stringify(target) + "] in " + caller + ".");
}

// Call the content service to acquire the document containing the metadata envelope and any
// associated attributes at this content ID.
function content(target, callback) {
  if (target.contentID) {
    var content_url = urljoin(
      config.content_service_url(), 'content', encodeURIComponent(target.contentID));

    logger.debug("Content service request: [" + content_url + "].");

    request(content_url, function (err, res, body) {
      if (err) return callback(err);

      if (res.statusCode === 404) {
        callback(response_error(res, "No content found for content at ID [" + target.contentID + "]"));
        return;
      }

      if (res.statusCode !== 200) {
        callback(response_error(res, "Error querying content service."));
        return;
      }

      logger.debug("Content service request: successful.");

      var content_doc = JSON.parse(body);
      content_doc.contentID = true;
      content_doc.prefix = target.prefix;

      callback(null, content_doc);
    });
  } else {
    callback(content_error(target, "content"));
  }
}

// If the content document contains any query results, resolve their content IDs to presented URLs.
function related(content_doc, callback) {
  if (! content_doc.results) {
    return callback(null, {});
  }

  var resultSetNames = _.keys(content_doc.results);

  async.map(
    resultSetNames,
    function (resultSetName, callback) {
      async.map(
        content_doc.results[resultSetName],
        function (result, callback) {
          if (result.contentID) {
            // Query the mapping service to discover the URL that will map to this result's
            // content ID.
            var mapping_url = urljoin(config.mapping_service_url(),
              'url',
              encodeURIComponent(result.contentID)
            );

            logger.debug("Mapping service request: [" + mapping_url + "]");

            request(mapping_url, function (err, res, body) {
              if (err) return callback(err);

              var
                doc = JSON.parse(body),
                u = doc.presentedURL,
                domain = config.public_url_domain(),
                proto = config.public_url_proto();

              if (domain || proto) {
                var parsed = url.parse(u);

                if (domain) {
                  parsed.host = domain;
                }

                if (proto) {
                  parsed.protocol = proto;
                }

                u = url.format(parsed);
              }

              result.url = u;

              callback(null, result);
            });
          } else {
            callback(null, result);
          }
        },
        callback
      );
    },
    function (err, resultSets) {
      if (err) return callback(err);

      var transformed = {};
      for (var i = 0; i < resultSetNames.length; i++) {
        var name = resultSetNames[i];

        transformed[name] = resultSets[i];
      }

      callback(null, transformed);
    }
  );
}

var handleError = function (error) {
    logger.error(error);
    if(error.statusCode) {
        return HttpErrorHelper.emit(error.statusCode.toString(), error);
    }

    return HttpErrorHelper.emit('500', error);
};

module.exports = function (req, res) {
    var contentId = ContentRoutingService.getContentId();
    var prefix = ContentRoutingService.getContentPrefix();
    var tocId = ContentRoutingService.getContentId(
        UrlService.getSitePath(prefix + '_toc')
    );

    async.parallel({
        content: function (callback) {
            content({contentID: contentId}, callback);
        },
        toc: function (callback) {
            content({contentID: tocId}, function (err, toc) {
                if(err) {
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

        // There are much nicer places to register these filters, but this will work for right now.
        ContentFilterService.add(function (content, next) {
            // Match nunjucks-like "{{ to('') }}" directives that are used to defer rendering of presented URLs
            // until presenter-time.
            var urlDirectiveRx = /\{\{\s*to\('([^']+)'\)\s*\}\}/g;

            if (content.contentID) {
                // Replace any "{{ to() }}" directives with
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

        ContentFilterService.filter(output.content, function (error, filteredContent) {
            if(error) {
                return HttpErrorHelper.emit('500');
            }

            res.send(TemplateService.render(TemplateRoutingService.getRoute(), {
                deconst: {
                    content: filteredContent
                }
            }));
        });
    });
};
