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
    var code = 500;
    if (err.statusCode && err.statusCode.toString() === "404") {
        code = 404;
    }

    var responseBody = TemplateService.render(this, code.toString());

    this.response.status(code).send(responseBody);
};

module.exports = Context;
