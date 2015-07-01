var config = require('../config');

var RequestHelper = {
    _request: null,
    get request() {
        return this._request;
    },
    set request(data) {
        this._request = data;
    },
    get host() {
        return config.presented_url_domain() || this._request.get('Host');
    },
    get protocol() {
        return config.presented_url_proto() || this._request.protocol;
    }
};

module.exports = RequestHelper;
