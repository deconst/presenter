var winston = require('winston');

var logger;

exports.requestLogger = function(level) {
  if (!logger) {
    exports.getLogger(level);
  }

  return function(req, res, next) {
    logger.verbose(req.method + ' ' + req.url);
    req.log = logger;
    next();
  };
};

exports.getLogger = function (level) {
  if (logger) {
    return logger;
  }

  logger = new winston.Logger({
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
        level: level || 'info',
        prettyPrint: true,
        colorize: true,
        timestamp: true
      })
    ]
  });

  return logger;
};