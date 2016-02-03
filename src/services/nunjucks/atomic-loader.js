var path = require('path');
var fs = require('fs');
var walk = require('walk');

var logger = require('../../server/logging').logger;

var AtomicLoader = function (templateSources) {
  this.templateSources = templateSources;
};

AtomicLoader.prototype.getSource = function (name) {
  return this.templateSources[name] || null;
};

var createAtomicLoader = function (templateSources, callback) {
  return callback(null, new AtomicLoader(templateSources));
};

module.exports = createAtomicLoader;
