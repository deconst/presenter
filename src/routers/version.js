// Handler to report the current application version.

var child_process = require('child_process'),
  info = require('../../package.json');

var commit = child_process.execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();

module.exports = function (req, res) {
  res.json({
    service: info.name,
    version: info.version,
    commit: commit
  });
};
