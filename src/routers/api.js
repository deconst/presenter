'use strict';

const ContentRoutingService = require('../services/content/routing');

exports.whereis = function (req, res) {
  let contentID = req.params.id;
  let mappings = ContentRoutingService.getMappingsForContentID(contentID);

  res.json({ mappings });
};
