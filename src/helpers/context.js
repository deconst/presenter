var
    config = require('../config'),
    TemplateService = require('../services/template');

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

Context.prototype.send = function (body) {
    this.response.send(body);
};

Context.prototype.handleError = function (err) {
    var code = err.statusCode || 500;
    if (err.statusCode && err.statusCode.toString() === "404") {
        code = 404;
    }

    TemplateService.render(this, code.toString(), {}, function (err, responseBody) {
        if (err) {
            console.error("I couldn't render an error template. I'm freaking out!", err);
            responseBody = "Er, I was going to render an error template, but I couldn't.";
        }

        this.response.status(code).send(responseBody);
    }.bind(this));
};

module.exports = Context;
