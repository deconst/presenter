// Handler to report the current application version.

var childProcess = require('child_process');
var info = require('../../package.json');

var commit = childProcess.execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();

module.exports = function (req, res) {
  res.json({
    service: info.name,
    version: info.version,
    commit: commit
  });
};
