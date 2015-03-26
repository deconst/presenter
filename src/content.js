// Handler to assemble a specific piece of static content.

var
  request = require('request'),
  urljoin = require('url-join'),
  config = require('./config');

// Derive the presented URL for a specific request, honoring the presented_url_domain setting if
// one is provided.
function presented_url(req) {
  var domain = config.presented_url_domain() || req.hostname;
  return "https://" + domain + req.path;
}

module.exports = function (req, presenterRes) {
  // Generate the mapping service URL.
  presented = presented_url(req);
  mapping_route = urljoin(config.mapping_service_url(), 'at', encodeURIComponent(presented));

  // Query the mapping service to acquire a content ID, or a 404 if the presented URL is way off.
  request(mapping_route, function(error, mappingRes, body) {
    if (!error && mappingRes.statusCode == 200) {
      body = JSON.parse(body);

      // Assemble the content service request URL for the returned content ID.
      content_route = urljoin(config.content_service_url(), 'content', encodeURIComponent(body['content-id']));

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
}
