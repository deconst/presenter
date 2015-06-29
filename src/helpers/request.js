var RequestHelper = {
    _request: null,
    get request() {
        return this._request;
    },
    set request(data) {
        this._request = data;
    },
    get host() {
        return process.env.PRESENTED_URL_DOMAIN || this._request.get('Host');
    },
    get protocol() {
        return process.env.PRESENTED_URL_PROTO || this._request.protocol;
    }
};

module.exports = RequestHelper;
