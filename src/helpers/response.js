var ResponseHelper = {
    _response: null,
    get response() {
        return this._response;
    },
    set response(data) {
        this._response = data;
    }
};

module.exports = ResponseHelper;
