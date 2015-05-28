// Handlebars helpers for use in templates.

var
  handlebars = require('handlebars'),
  moment = require('moment');

var formatDateHelper = function (date, formatString) {
  return moment(Date.parse(date)).format(formatString);
};

exports.register = function () {
  handlebars.registerHelper('formatDate', formatDateHelper);
};
