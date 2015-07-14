var ResponseHelper = {
    _response: null,
    get response() {
        return this._response;
    },
    set response(data) {
        this._response = data;
        this._response.statusSent = false;
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
        if(this.response.statusSent) {
            return;
        }

        this.response.status.apply(this.response, arguments);

        // mischief managed
        this.response.statusSent = true;
    }
};

module.exports = ResponseHelper;
