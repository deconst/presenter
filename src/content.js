// Handler to assemble a specific piece of static content.

var
  request = require('request'),
  urljoin = require('url-join'),
  async = require('async'),
  config = require('./config'),
  logging = require('./logging');

var logger = logging.getLogger();

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

    logger.debug("Mapping service response: successful.").

    body = JSON.parse(body);
    content_id = body["content-id"];
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

    metadata = JSON.parse(body);
    callback(null, metadata);
  });
}

// Call the layout service to decide which layout to apply to this content ID.
function layout(content_id, callback) {
  // TODO call the layout service here.
  callback(null, "layouts/temp.handlebars");
}

module.exports = function (req, res) {
  var presented = presented_url(req);

  logger.verbose("Handling presented URL [" + presented + "].");

  async.waterfall([
    function (callback) {
      mapping(presented, callback);
    },
    function (content_id, callback) {
      async.parallel({
        content: function (cb) { content(content_id, cb); },
        layout: function (cb) { layout(content_id, cb); }
      }, callback);
    }
  ], function (err, result) {
    if (err) {
      logger.error("Assembling: " + err);
      res.send("Assembling: " + err);
      res.status(404).end();
      return;
    }

    res.render(result.layout, metadata, function (err, html) {
      if (err) {
        logger.error("Rendering: " + err);
        res.send("Rendering: " + err);
        res.status(500).end();
        return;
      }

      res.send(html);
    });
  });
};
