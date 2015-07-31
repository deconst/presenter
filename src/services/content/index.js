var
    request = require('request'),
    config = require('../../config'),
    logger = require('../../server/logging').logger,
    urljoin = require('url-join');

var INFRA_ERRORS = ['ENOTFOUND','ETIMEDOUT','ECONNREFUSED'];

var ContentService = {
    get: function (id, options, callback) {
        if (!id) {
            // without a contentID, this is like a 404
            return callback({
                statusCode: 404,
                message: "Unable to locate content ID"
            });
        }

        var contentUrl = urljoin(
            config.content_service_url(),
            'content',
            encodeURIComponent(id)
        );

        logger.debug("Content service request: [" + contentUrl + "].");
        var reqStart = Date.now();

        request(contentUrl, function (err, res, body) {
            var reqDuration = Date.now() - reqStart;

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
                    messageBody = body || "Empty response";
                }

                return callback({
                    statusCode: res.statusCode,
                    message: messageBody,
                    contentReqDuration: reqDuration
                });
            }

            logger.debug({
                message: "Content service request: successful.",
                contentReqDuration: reqDuration
            });

            callback(null, JSON.parse(body));
        });
    },
    getAssets: function (callback) {
        logger.debug("Content service request: requesting assets.");
        var assetUrl = urljoin(config.content_service_url(), 'assets');

        var reqStart = Date.now();

        request(assetUrl, function (err, res, body) {
            var reqDuration = Date.now() - reqStart;

            if (err) {
                return callback(err);
            }

            if (res.statusCode >= 400) {
                var messageBody;
                try {
                    messageBody = JSON.parse(body);
                } catch (e) {
                    messageBody = body || "Empty response";
                }

                return callback({
                    statusCode: res.statusCode,
                    message: messageBody,
                    assetReqDuration: reqDuration
                });
            }

            logger.debug({
                message: "Content service asset request: successful.",
                assetReqDuration: reqDuration
            });

            callback(null, JSON.parse(body));
        });
    }
};

module.exports = ContentService;
