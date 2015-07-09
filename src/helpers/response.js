var ResponseHelper = {
    _response: null,
    get response() {
        return this._response;
    },
    set response(data) {
        this._response = data;
    },
    redirect: function () {
        // Noop if headers were already sent
        if(this.response.headersSent) {
            return;
        }

        this.response.redirect.apply(this.response, arguments);
    },
    set: function () {
        this.response.set.apply(this.response, arguments);
    },
    send: function () {
        // Noop if headers were already sent
        if(this.response.headersSent) {
            return;
        }

        this.response.send.apply(this.response, arguments);
    },
    status: function () {
        this.response.status.apply(this.response, arguments);
    }
};

module.exports = ResponseHelper;
