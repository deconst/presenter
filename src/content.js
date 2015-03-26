// Handler to assemble a specific piece of static content.

var
  request = require('request'),
  urljoin = require('url-join'),
  async = require('async'),
  config = require('./config');

// Derive the presented URL for a specific request, honoring the presented_url_domain setting if
// one is provided.
function presented_url(req) {
  var domain = config.presented_url_domain() || req.hostname;
  return "https://" + domain + req.path;
}

// Call the mapping service to identify the content ID that's mapped to the presented URL.
function mapping(presented, callback) {
  mapping_url = urljoin(config.mapping_service_url(), 'at', encodeURIComponent(presented));

  request(mapping_url, function (error, res, body) {
    if (error) {
      callback(error);
      return;
    }

    if (res.statusCode !== 200) {
      callback(new Error("No mapping found for presented URL [" + presented + "]"));
      return;
    }

    body = JSON.parse(body);
    callback(null, body['content-id']);
  });
}

// Call the content service to acquire the metadata envelope at this content ID.
function content(content_id, callback) {
  content_url = urljoin(config.content_service_url(), 'content', encodeURIComponent(content_id));

  request(content_url, function (error, res, body) {
    if (error) {
      callback(error);
      return;
    }

    if (res.statusCode !== 200) {
      callback(new Error("No content found for content ID [" + content_id + "]"));
      return;
    }

    metadata = JSON.parse(metadata);
    callback(null, metadata);
  });
}

// Call the layout service to decide which layout to apply to this content ID.
function layout(content_id, callback) {
  // TODO call the layout service here.
  callback(null, "layouts/temp.handlebars");
}

module.exports = function (req, res) {
  presented = presented_url(req);

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
      console.error(err);
      res.send("Error: " + err);
      res.status(404).end();
      return;
    }

    res.render(result.layout, metadata, function (err, html) {
      if (err) {
        console.error(err);
        res.send("Rendering error: " + err);
        res.status(500).end();
        return;
      }

      res.send(html);
    })
  });
}
