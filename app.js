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

var http = require('http');
var express = require('express'),
    exphbs  = require('express-handlebars');

var app = express();
app.engine('handlebars', exphbs());
app.set('view engine', 'handlebars');

app.get('/', function(req, presenterRes) {
  // form route to query
  mapping_route = normalize_url(mapping_service_url) + '/at/' + encodeURIComponent(req.hostname) + encodeURIComponent(req.path);
  // query mapping service for content ID
  http.get(mapping_route, function(mappingRes) {
    switch(mappingRes.statusCode) {
      // handle key not found
      case 404:
        presenterRes.statusCode = 404;
        presenterRes.send('Map key not found in mapping service.');
        break;
      // handle redirect
      case 300, 301, 302, 303, 304, 307, 308:
        presenterRes.redirect(mappingRes.statusCode, mappingRes.headers.location);
        break;
      // handle key found
      case 200:
        var body = '';
        mappingRes.on('data', function(chunk) {
          body += chunk;
        });
        mappingRes.on('end', function(){
          // parse string reponse to JSON
          body = JSON.parse(body);
          // form content route
          content_route = normalize_url(content_service_url) + '/content/' + encodeURIComponent(body['content-id']);
          // query content service for metadata
          http.get(content_route, function(contentRes){
            switch(contentRes.statusCode) {
              // handle content ID not found
              case 404:
                presenterRes.statusCode = 404;
                throw new Error('Content not found in content service');
                break;
              // handle content ID found
              case 200:
                var body = '';
                contentRes.on('data', function(chunk) {
                  body += chunk;
                });
                contentRes.on('end', function(){
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
                });
                contentRes.on('error', function(e){
                  throw new Error('Error retrieving data from content service');
                });
                break;
            }
          });
        });
        mappingRes.on('error', function(e){
          throw new Error('Error retrieving data from mapping service');
        });
        break;
    }
  });
});

var server = app.listen(8080);
