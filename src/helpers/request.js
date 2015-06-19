var RequestHelper = {
    _request: null,
    get request() {
        return this._request;
    },
    set request(data) {
        this._request = data;
    }
};

module.exports = RequestHelper;
