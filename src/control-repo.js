// Since the control repo is just an NPM package, we could technically just
// `npm install` it.
var ControlRepo = require(process.env.CONTROL_REPO_PATH);

module.exports = ControlRepo;
