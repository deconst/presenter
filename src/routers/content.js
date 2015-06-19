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
  TemplateService = require('../services/template');

// The pages to render if an error page layout isn't defined for a specific status code.
var
  staticRoot = path.join(__dirname, '../..', 'static'),
  page404 = fs.readFileSync(path.join(staticRoot, "404.html")).toString('utf-8'),
  page500 = fs.readFileSync(path.join(staticRoot, "500.html")).toString('utf-8');

// The layout to use if no layout_key is requested by the metadata envelope.
var nullLayout = handlebars.compile("{{{ envelope.body }}}");

// Derive the presented URL for a specific request, honoring the presented_url_domain and
// presented_url_proto settings if provided.
function presented_url(req) {
  var proto = config.presented_url_proto() || req.protocol;
  var domain = config.presented_url_domain() || req.hostname;

  return proto + "://" + domain + req.path;
}

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

// Call the mapping service to identify the content ID that's mapped to the presented URL.
function mapping(presented, callback) {
  var mapping_url = urljoin(config.mapping_service_url(), 'at', encodeURIComponent(presented));
  logger.debug("Mapping service request: [" + mapping_url + "]");

  request(mapping_url, function (error, res, body) {
    if (error) {
      callback(error);
      return;
    }

    if (res.statusCode !== 200) {
      callback(response_error(res, "No mapping found for presented URL [" + presented + "]"));
      return;
    }

    var target = JSON.parse(body);
    logger.debug("Mapping service response: success", target);
    callback(null, target);
  });
}

// Call the content service to acquire the document containing the metadata envelope and any
// associated attributes at this content ID.
function content(target, callback) {
  if (target.proxyTo) {
    var proxy_url = target.proxyTo;

    logger.debug("Proxy request: [" + proxy_url + "].");

    var proxy_res = request(proxy_url);

    proxy_res.on("response", function (res) {
      if (res.statusCode < 200 || res.statusCode >= 400) {
        // Log the error request, but still pass it through.
        logger.warn("Status code [" + res.statusCode +
          "] received from upstream service [" + proxy_url + "].");
      }
    });

    var content_doc = { proxyTo: true, response: proxy_res };
    callback(null, content_doc);
  } else if (target.contentID) {
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

function globals(presentedUrl, contentDoc, callback) {
    // Fetch globals. Right now the only global is a per-prefix ToC, so this
    // function is super-simple.
    if(typeof contentDoc.prefix === 'undefined') {
        return callback(null, {});
    }

    var tocUrl = presentedUrl.substring(
        0,
        presentedUrl.indexOf(
            contentDoc.prefix,
            presentedUrl.indexOf('://') + 3
        ) + contentDoc.prefix.length
    ) + '_toc';

    async.waterfall([
        async.apply(mapping, tocUrl),
        content
    ], function (err, output) {
        if(err) {
            // this is technically optional, so return a null-ish object if the
            // ToC wasn't found
            return callback(null, {});
        }

        return callback(null, {
            toc: output.envelope.body
        });
    });
}

// Now that a content document is available, perform post-processing calls in parallel.
function postprocess(presented_url, content_doc, callback) {
  if (content_doc.proxyTo) {
    callback(null, content_doc);
  } else if (content_doc.contentID) {
    async.parallel([
      async.apply(related, content_doc),
      async.apply(layout, presented_url, content_doc),
      async.apply(globals, presented_url, content_doc)
    ], function (err, output) {
      if (err) return callback(err);

      var output_doc = {
        envelope: content_doc.envelope,
        assets: content_doc.assets,
        prefix: content_doc.prefix,
        results: output[0],
        layout: output[1],
        globals: output[2]
      };

      callback(null, output_doc);
    });
  } else {
    callback(content_error(content_doc, "postprocess"), {});
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

// Call the layout service to decide which layout to apply to this presented URL.
function layout(presented_url, content_doc, callback) {
  var layout_key = content_doc.envelope.layout_key;

  if (!layout_key) {
    logger.debug("No layout key requested. Using null layout.");

    return callback(null, nullLayout);
  }

  var
    encoded_presented = encodeURIComponent(presented_url),
    layout_url = urljoin(config.layout_service_url(), encoded_presented, layout_key);

  logger.debug("Layout service request: [" + layout_url + "]");

  request(layout_url, function (error, res, body) {
    if (error) {
      callback(error);
      return;
    }

    if (res.statusCode !== 200) {
      callback(response_error(res, "No layout found for presented URL [" + presented_url + "]"));
      return;
    }

    var layout = handlebars.compile(body);

    callback(null, layout);
  });
}

// If a 404 or 500 occurs anywhere in the pipeline, return a custom error page.
function error_layout(presented_url, status_code, callback) {
  encoded_presented = encodeURIComponent(presented_url);
  layout_url = urljoin(config.layout_service_url(), 'error', encoded_presented, status_code);

  logger.debug("Error layout page request: [" + layout_url + "]");

  request(layout_url, function (error, res, body) {
    if (error) {
      callback(error);
      return;
    }

    if (res.statusCode === 404) {
      logger.warn("No error layout found for status code [" + status_code + "].");

      if (status_code === 404) {
        callback(null, page404);
      } else {
        callback(null, page500);
      }

      return;
    }

    if (res.statusCode !== 200) {
      callback(response_error(res, "No error layout page for url [" + layout_url + "]"));
      return;
    }

    callback(null, body);
  });
}

function old_content (req, res) {
  var presented = presented_url(req);

  logger.verbose("Handling presented URL [" + presented + "].");

  async.waterfall([
    async.apply(mapping, presented),
    content,
    async.apply(postprocess, presented)
  ], function (err, content_doc) {
    if (err) {
      var code = err.statusCode || 500;
      var message = err.statusMessage || "Error";

      logger.info(message + ": [" + code + "] " + err);

      error_layout(presented, code, function(layout_err, layout_body) {
        if (layout_err) {
          logger.error("Unable to retrieve custom error layout for HTTP status [" + code + "]", layout_err);
        }
        res.status(code).send(layout_body || page500);
      });
      return;
    }

    if (content_doc.proxyTo) {
      content_doc.response.pipe(res);
    } else {
      // Apply final transformations and additions to the content document before rendering.
      content_doc.presented_url = presented;
      content_doc.has_next_or_previous =
        !!(content_doc.envelope.next || content_doc.envelope.previous);

      // Normalize "next" and "previous" URLs that are absolute to the document root.
      var
        n = content_doc.envelope.next,
        p = content_doc.envelope.previous;
      if (n && n.url[0] === '/') {
        n.url = urljoin(content_doc.prefix, n.url);
      }
      if (p && p.url[0] === '/') {
        p.url = urljoin(content_doc.prefix, p.url);
      }

    //   logger.debug("Rendering final content document:", content_doc);

      if (content_doc.envelope.content_type) {
        res.set("Content-Type", content_doc.envelope.content_type);
      }

    //   var html = content_doc.layout(content_doc);

      var html = TemplateService.render(content_doc.envelope.layout_key, {
          deconst: {
              content: content_doc
          }
      });

      logger.debug(content_doc);

      res.send(html);
    }
  });
}

var TemplateService = require('../services/template');
var TemplateRoutingService = require('../services/template-routing');
var ContentRoutingService = require('../services/content-routing');

module.exports = function (req, res) {
    var contentId = ContentRoutingService.getContentId();

    content({contentID: contentId}, function (err, result) {

        res.send(TemplateService.render(TemplateRoutingService.getRoute(), {
            deconst: {
                content: result
            }
        }));
    });
};
