/*
* app.js: Entry point for the presenter
*
* (C) 2015 Rackspace, Inc.
*
*/

function normalize_url(url) {
  if (url.slice(-1) == '/') {
    return url.slice(0, -1);
  }
  return url;
}

var mapping_service_url;
var content_service_url;
var presented_url_domain = process.env.PRESENTED_URL_DOMAIN;

// TODO: create function that long-polls and waits for an etcd key change, then calls
// get_mapping_service_url() and get_content_service_url() to update the
// mapping_service_url and content_service_url vars.

function set_mapping_service_url() {
  // TODO: replace process.env with etcd call
  mapping_service_url = normalize_url(process.env.MAPPING_SERVICE_URL);
}

function set_content_service_url() {
  // TODO: replace process.env with etcd call
  content_service_url = normalize_url(process.env.CONTENT_SERVICE_URL);
}

// Derive the presented URL for a specific request, honoring the presented_url_domain setting if
// one is provided.
function presented_url(req) {
  var domain = presented_url_domain ? presented_url_domain : req.hostname;
  return "https://" + domain + req.path;
}

set_mapping_service_url();
set_content_service_url();

var request = require('request'),
    urljoin = require('url-join'),
    express = require('express'),
    exphbs  = require('express-handlebars');

var app = express();
app.engine('handlebars', exphbs());
app.set('view engine', 'handlebars');

app.get('/*', function(req, presenterRes) {
  // Generate the mapping service URL.
  mapping_route = urljoin(mapping_service_url, 'at', encodeURIComponent(presented_url(req)));

  // Query the mapping service to acquire a content ID, or a 404 if the presented URL is way off.
  request(mapping_route, function(error, mappingRes, body) {
    if (!error && mappingRes.statusCode == 200) {
      body = JSON.parse(body);

      // Assemble the content service request URL for the returned content ID.
      content_route = urljoin(content_service_url, 'content', encodeURIComponent(body['content-id']));

      // Query the content service for a metadata envelope, or a 404 if the content ID is not present.
      request(content_route, function(error, mappingRes, body) {
        if (!error && mappingRes.statusCode == 200) {
          // Parse the metadata envelope as JSON.
          metadata = JSON.parse(body);

          // TODO: determine layout structure for content (perhaps calling the
          // mapping service or a layout service). For now, it's hard-coded.
          layout_type = 'layouts/temp.handlebars';

          // Render the final content from the metadata envelope.
          presenterRes.render(layout_type, metadata, function(err, html) {
            if (err) {
              throw new Error('Error rendering content');
            }

            // Send the rendered HTML back to the user.
            presenterRes.send(html);
          });
        } else {
          presenterRes.status(404).end();
          throw new Error('Content not found in content service');
        }
      });
    } else {
      presenterRes.status(404).end();
      throw new Error('Map key not found in mapping service.');
    }
  });
});

var server = app.listen(8080);
