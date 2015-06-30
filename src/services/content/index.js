var request = require('request'),
    config = require('../../config'),
    logger = require('../../server/logging').logger,
    urljoin = require('url-join');

var ContentService = {
    get: function (id, options, callback) {
        if(!id) {
            logger.error('No content found for content at ID [' + id + ']');

            // without a contentID, this is like a 404
            return callback({
              statusCode: '404'
            });
        }

        var contentUrl = urljoin(
            config.content_service_url(),
            'content',
            encodeURIComponent(id)
        );

        logger.debug("Content service request: [" + contentUrl + "].");

        request(contentUrl, function (err, res, body) {
            if (err) {
                if(options.ignoreErrors === true) {
                    // This error should not be considered fatal
                    return callback(null, null);
                }

                return callback(err);
            }

            if(res.statusCode >= 400) {
                var messageBody;
                try {
                    messageBody = JSON.parse(body);
                }
                catch (e) {
                    messageBody = 'Not Found';
                }

                return callback({
                    statusCode: res.statusCode,
                    message: messageBody
                });
            }

            logger.debug("Content service request: successful.");

            callback(null, JSON.parse(body));
        });
    }
};

module.exports = ContentService;
