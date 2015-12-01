var request = require('request');
var config = require('../../config');
var logger = require('../../server/logging').logger;
var urljoin = require('url-join');

var INFRA_ERRORS = ['ENOTFOUND', 'ETIMEDOUT', 'ECONNREFUSED'];

var ContentService = {
  get: function (context, id, options, callback) {
    if (!id) {
      // without a contentID, this is like a 404
      return callback({
        statusCode: 404,
        message: 'Unable to locate content ID'
      });
    }

    var contentUrl = urljoin(
      config.content_service_url(),
      'content',
      encodeURIComponent(id)
    );

    logger.debug('Content service request: [' + contentUrl + '].');
    var reqStart = Date.now();

    request(contentUrl, function (err, res, body) {
      var reqDuration = Date.now() - reqStart;
      context.contentReqDuration = reqDuration;

      if (err) {
        if (options.ignoreErrors === true) {
          // This error should not be considered fatal
          return callback(null, null);
        }

        if (err && err.code && INFRA_ERRORS.indexOf(err.code) !== -1) {
          return callback({
            statusCode: 503,
            message: err.code,
            contentReqDuration: reqDuration
          });
        }

        return callback(err);
      }

      if (res.statusCode >= 400) {
        var messageBody;
        try {
          messageBody = JSON.parse(body);
        } catch (e) {
          messageBody = body || 'Empty response';
        }

        return callback({
          statusCode: res.statusCode,
          message: messageBody
        });
      }

      logger.debug({
        message: 'Content service request: successful.',
        contentReqDuration: reqDuration
      });

      callback(null, JSON.parse(body));
    });
  },
  getAssets: function (context, callback) {
    logger.debug('Content service request: requesting assets.');
    var assetUrl = urljoin(config.content_service_url(), 'assets');

    var reqStart = Date.now();

    request(assetUrl, function (err, res, body) {
      var reqDuration = Date.now() - reqStart;
      context.assetReqDuration = reqDuration;

      if (err) {
        return callback(err);
      }

      if (res.statusCode >= 400) {
        var messageBody;
        try {
          messageBody = JSON.parse(body);
        } catch (e) {
          messageBody = body || 'Empty response';
        }

        return callback({
          statusCode: res.statusCode,
          message: messageBody,
          assetReqDuration: reqDuration
        });
      }

      logger.debug({
        message: 'Content service asset request: successful.',
        assetReqDuration: reqDuration
      });

      callback(null, JSON.parse(body));
    });
  },
  getSearch: function (q, pageNumber, perPage, callback) {
    var searchUrl = urljoin(config.content_service_url(), 'search');
    var searchQuery = {
      q: q,
      pageNumber: pageNumber,
      perPage: perPage
    };
    var reqStart = Date.now();

    logger.debug('Content service request: performing search.', {
      url: searchUrl,
      query: searchQuery
    });

    request({ url: searchUrl, qs: searchQuery }, function (err, res, body) {
      var reqDuration = Date.now() - reqStart;
      if (err) return callback(err);

      if (res.statusCode === 404) {
        // Compatibility with older content services
        return callback(null, { total: 0, results: [] });
      }

      if (res.statusCode >= 400) {
        var messageBody;
        try {
          messageBody = JSON.parse(body);
        } catch (e) {
          messageBody = body || 'Empty response';
        }

        return callback({
          statusCode: res.statusCode,
          message: messageBody,
          searchReqDuration: reqDuration
        });
      }

      var doc = {};
      try {
        doc = JSON.parse(body);
      } catch (e) {
        return callback(e);
      }

      logger.debug('Content service request: search successful.', {
        resultCount: doc.results.length,
        searchReqDuration: reqDuration
      });

      callback(null, doc);
    });
  },
  getControlSHA: function (context, callback) {
    var shaUrl = urljoin(config.content_service_url(), 'control');
    var reqStart = Date.now();
    logger.debug('Content service request: control repository SHA', {
      url: shaUrl
    });

    request(shaUrl, function (err, res, body) {
      var reqDuration = Date.now() - reqStart;
      if (err) return callback(err);

      if (res.statusCode === 404) {
        // Compatibility with older content services
        return callback(null, null);
      }

      if (res.statusCode >= 400) {
        var messageBody;
        try {
          messageBody = JSON.parse(body);
        } catch (e) {
          messageBody = body || 'Empty response';
        }

        return callback({
          statusCode: res.statusCode,
          message: messageBody,
          assetReqDuration: reqDuration
        });
      }

      var doc = {};
      try {
        doc = JSON.parse(body);
      } catch (e) {
        return callback(e);
      }

      logger.debug({
        message: 'Content service control SHA request: successful.',
        controlShaReqDuration: reqDuration,
        document: doc
      });

      callback(null, doc.sha);
    });
  }
};

module.exports = ContentService;
