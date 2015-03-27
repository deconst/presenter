/*
* fake_mapping_service.js: Fake mapping service
*
* (C) 2015 Rackspace, Inc.
*
*/

var express = require('express');

var app = express();

app.get('/at/:presented_id', function(req, res) {
  res.send('{"content-id": "https://github.com/deconst/deconst-docs"}');
});

var server = app.listen(8081, function() {
  console.log('Fake Mapper listening at ' + server.address().address + ':' + server.address().port);
});
