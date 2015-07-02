var fs = require('fs');
var url = require('url');
var config = require('../config');
var logger = require('./logging').logger;
var PathService = require('../services/path');
var RequestHelper = require('../helpers/request');

module.exports = function (app) {
    var userRewrites = function () {
        /**
         * @todo This same logic of reading JSON files is in a few places. It should be
         *       abstracted into something like `ConfigService.readConfigFile(fileName)`
         */
        var rewritesFile, rewritesFileData, rewrites;
        rewritesFile = config.control_rewrites_file();


        try {
            rewritesFileData = JSON.parse(fs.readFileSync(
                PathService.getConfigPath(rewritesFile),
                'utf-8'
            ));

            logger.debug('Reading rewrites from %s', PathService.getConfigPath(rewritesFile));
        }
        catch (e) {
            logger.warn('No valid JSON file found at %s', PathService.getConfigPath(rewritesFile));
            var rewritesFileData = [];
        }

        rewrites = rewritesFileData[RequestHelper.host] || [];

        app.use(function (req, res, next) {
            var stopProcessing = false;

            rewrites.forEach(function (rule, index, scope) {
                // Stop processing rules if a redirect has been sent
                if(stopProcessing) {
                    return;
                }

                var isRewrite = rule.rewrite || false;
                var status = rule.status || 301;
                var fromPattern = new RegExp(rule.from, 'g');

                if(!req.url.match(fromPattern)) {
                    return;
                }

                // If the incoming URL's pathname matches the pattern, replace
                // it with the rule's "to" pattern
                var parsedUrl = url.parse(req.url, true);
                parsedUrl.pathname = parsedUrl.pathname.replace(fromPattern, rule.to);

                req.url = url.format(parsedUrl);

                // Stop processing and redirect if this isn't a rewrite
                if(!isRewrite) {
                    logger.debug('Redirecting to %s', req.url);
                    stopProcessing = true;
                    res.redirect(status, req.url);
                    // res.end();
                }

                logger.debug('Rewriting URL to %s', req.url);
            });

            // If a redirect has been sent, don't process any other middlewares
            if(!stopProcessing) {
                next();
            }
        });
    };

    // Do system rewrites first

    // Multiple slashes become a single slash.
    app.use(function (req, res, next) {
        var emptySegment = /\/[\/]+/;
        var parsedUrl = url.parse(req.url, true);

        if(emptySegment.test(parsedUrl.pathname)) {
            parsedUrl.pathname = parsedUrl.pathname.replace(emptySegment, '/');
            req.url = url.format(parsedUrl);
        }

        return next();
    });

    // Then add the user's rewrites
    userRewrites();

};
