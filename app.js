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
var presented_url_host = process.env.PRESENTED_URL_HOST;

// TODO: create function that long-polls and waits for an etcd key change, then calls
// get_mapping_service_url() and get_content_service_url() to update the
// mapping_service_url and content_service_url vars.

function set_mapping_service_url() {
  // TODO: replace process.env with etcd call
  mapping_service_url = process.env.MAPPING_SERVICE_URL;
}

function set_content_service_url() {
  // TODO: replace process.env with etcd call
  content_service_url = process.env.CONTENT_SERVICE_URL;
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

app.get('/', function(req, presenterRes) {
  // form route to query
  mapping_route = urljoin(normalize_url(mapping_service_url), 'at', encodeURIComponent(req.hostname + req.path));
  // query mapping service for content ID
  request(mapping_route, function(error, mappingRes, body) {
    if (!error && mappingRes.statusCode == 200) {
      body = JSON.parse(body);
      // form content route
      content_route = urljoin(normalize_url(content_service_url), 'content', encodeURIComponent(body['content-id']));
      // query content service for metadata
      request(content_route, function(error, mappingRes, body){
        if (!error && mappingRes.statusCode == 200) {
          // parse string reponse to JSON
          metadata = JSON.parse(body);
          // TODO: determine layout structure for content (perhaps calling the
          // mapping service or a layout service). For now, it's hard-coded.
          layout_type = 'layouts/temp.handlebars';
          // render content with metadata
          presenterRes.render(layout_type, metadata, function(err, html) {
            if(err) {
              throw new Error('Error rendering content');
            }
            // send rendered html to user
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
