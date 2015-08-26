var mware = require('mware')();
var message = {};

var ContentFilterService = {
  add: function (fn) {
    mware(fn);
  },

  filter: function (input, output) {
    message = input;

    mware.run(message, function (err) {
      output(err, message);
      message = {};
    });
  }
};

module.exports = ContentFilterService;
