// Handler to assemble a specific piece of static content.

var
  request = require('request'),
  urljoin = require('url-join'),
  async = require('async'),
  handlebars = require('handlebars'),
  config = require('./config'),
  logging = require('./logging');

var logger = logging.getLogger();

var page500 = "<!DOCTYPE html>" +
  "<html>" +
  "<head>" +
    "<meta charset=\"utf-8\">" +
    "<title>Rendered by Deconst</title>" +
  "</head>" +
  "<body>" +
    "<h1>Whoops</h1>" +
    "<p>It looks like you asked for a page that we don't have!</p>" +
  "</body>" +
  "</html>";

// Derive the presented URL for a specific request, honoring the presented_url_domain setting if
// one is provided.
function presented_url(req) {
  var domain = config.presented_url_domain() || req.hostname;
  return "https://" + domain + req.path;
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
      callback(new Error("No mapping found for presented URL [" + presented + "]"));
      return;
    }

    var doc = JSON.parse(body);
    content_id = doc["content-id"];

    logger.debug("Mapping service response: success => [" + content_id + "]");
    callback(null, content_id);
  });
}

// Call the content service to acquire the metadata envelope at this content ID.
function content(content_id, callback) {
  var content_url = urljoin(config.content_service_url(), 'content', encodeURIComponent(content_id));
  logger.debug("Content service request: [" + content_url + "]");

  request(content_url, function (error, res, body) {
    if (error) {
      callback(error);
      return;
    }

    if (res.statusCode !== 200) {
      callback(new Error("No content found for content ID [" + content_id + "]"));
      return;
    }

    logger.debug("Content service request: successful.");

    envelope = JSON.parse(body);
    callback(null, envelope);
  });
}

// Call the layout service to decide which layout to apply to this presented URL.
function layout(presented_url, envelope, callback) {
  var
    layout_key = envelope.layout_key || "default",
    encoded_presented = encodeURIComponent(presented_url),
    layout_url = urljoin(config.layout_service_url(), encoded_presented, layout_key);

  logger.debug("Layout service request: [" + layout_url + "]");

  request(layout_url, function (error, res, body) {
    if (error) {
      callback(error);
      return;
    }

    if (res.statusCode !== 200) {
      var err = new Error("No layout found for presented URL [" + presented_url + "]");
      err.type = "NotFound";
      callback(err);
      return;
    }

    var layout = handlebars.compile(body);

    callback(null, {
      envelope: envelope,
      layout: layout
    });
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

    if (res.statusCode !== 200) {
      var err = new Error("No error layout page for url [" + layout_url + "]");
      callback(err);
      return;
    }

    var layout = handlebars.compile(body);

    callback(null, res, layout);
  });
}

module.exports = function (req, res) {
  var presented = presented_url(req);

  logger.verbose("Handling presented URL [" + presented + "].");

  async.waterfall([
    async.apply(mapping, presented),
    content,
    async.apply(layout, presented)
  ], function (err, result) {
    if (err) {
      var code = 404;
      if(err.type === "NotFound") {
        logger.error("NotFound: " + err);
      } else {
        logger.error("ServerError: " + err);
        code = 500;
      }
      error_layout(presented, code, function(error, response, body) {
        if(response.statusCode !== 200 || result.error) {
          response.status(code).send(page500);
        }
        response.status(code).send(body);
      });
      return;
    }

    var html = result.layout({
      envelope: result.envelope
    });

    res.send(html);
  });
};
