var winston = require('winston');
var config = require('../config');

var activeTransports = [];

if (process.env.NODE_ENV === 'production') {
  activeTransports.push(new winston.transports.Console({
    level: config.log_level().toLowerCase(),
    prettyPrint: false,
    colorize: config.log_colorize(),
    timestamp: true,
    json: true,
    stringify: true,
    handleExceptions: true
  }));
} else {
  activeTransports.push(new winston.transports.Console({
    level: config.log_level().toLowerCase(),
    prettyPrint: true,
    colorize: config.log_colorize(),
    timestamp: true,
  }));
}

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
  transports: activeTransports
});

exports.requestLogger = function () {
  return function (req, res, next) {
    exports.logger.verbose(req.method + ' ' + req.url);
    req.log = exports.logger;
    next();
  };
};
