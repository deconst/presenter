'use strict';
// Hardcode the robots.txt for staging servers. For production servers, fall through to the normal
// content flow.

const config = require('../config');
const content = require('./content');

module.exports = function (req, res) {
  if (!config.staging_mode()) {
    return content(req, res);
  }

  res.set('Content-type', 'text/plain');
  res.send('User-agent: *\nDisallow: /\n');
};
