var config = require('../config');

function Context(req, resp) {
    this.request = req;
    this.response = resp;
}

Context.prototype.host = function () {
    return config.presented_url_domain() || this.request.get('Host');
};

Context.prototype.protocol = function () {
    return config.presented_url_proto() || this._request.protocol;
};

module.exports = Context;
