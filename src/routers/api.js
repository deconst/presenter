'use strict';

const logger = require('../server/logging').logger;
const Context = require('../helpers/context');
const ContentService = require('../services/content');
const ContentRoutingService = require('../services/content/routing');

exports.whereis = function (req, res) {
  let contentID = req.params.id;
  let mappings = ContentRoutingService.getMappingsForContentID(contentID);

  res.json({ mappings });
};

exports.search = function (req, res) {
  const context = new Context(req, res);

  ContentService.getSearch(context, req.query, (err, r) => {
    if (err) {
      logger.warn('Error during content service query', err);

      return res.status(502).json({ error: err.message });
    }

    res.json(r);
  });
};
