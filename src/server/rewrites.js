var fs = require('fs');
var config = require('../config');
var logger = require('./logging').logger;
var PathService = require('../services/path');
var RequestHelper = require('../helpers/request');

module.exports = function (app) {
    /**
     * @todo This same logic of reading JSON files is in a few places. It should be
     *       abstracted into something like `ConfigService.readConfigFile(fileName)`
     */
    var REWRITES_FILE = config.control_rewrites_file();

    try {
        var rewrites = JSON.parse(fs.readFileSync(
            PathService.getConfigPath(REWRITES_FILE),
            'utf-8'
        ))[RequestHelper.host];

        logger.debug('Reading rewrites from %s', PathService.getConfigPath(REWRITES_FILE));
    }
    catch (e) {
        logger.warn('No valid JSON file found at %s', PathService.getConfigPath(REWRITES_FILE));
        var rewrites = [];
    }

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

            // If the incoming URL matches the pattern, replace it with the
            // rule's "to" pattern
            req.url = req.url.replace(fromPattern, rule.to);

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
