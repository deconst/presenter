var
  winston = require('winston'),
  config = require('../config');

exports.logger = new winston.Logger({
  levels: {
    trace: 0,
    debug: 1,
    verbose: 2,
    info: 3,
    warn: 4,
    error: 5
  },
  colors: {
    trace: 'white',
    debug: 'grey',
    verbose: 'cyan',
    info: 'green',
    warn: 'yellow',
    error: 'red'
  },
  transports: [
    new winston.transports.Console({
      level: config.log_level().toLowerCase(),
      prettyPrint: true,
      colorize: true,
      timestamp: true
    })
  ]
});

exports.requestLogger = function() {
  return function(req, res, next) {
    exports.logger.verbose(req.method + ' ' + req.url);
    req.log = exports.logger;
    next();
  };
};
