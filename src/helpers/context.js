'use strict';

const logger = require('../server/logging').logger;
const config = require('../config');
const ContentRoutingService = require('../services/routing');
const TemplateService = require('../services/template');

function Context (req, resp) {
  this.request = req;
  this.response = resp;
  this.startTimestamp = Date.now();

  this.contentId = null;
  this.templatePath = null;
  this.assets = {};

  this.contentReqDuration = null;
  this.assetReqDuration = null;
  this.templateRenderDuration = null;

  if (config.staging_mode()) {
    this._applyStagingMode();
  }
}

Context.prototype._applyStagingMode = function () {
  this.originalPresentedPath = this.request.path;

  let parts = this.request.path.split('/');
  while (parts[0] === '') {
    parts.shift();
  }

  let first = parts.shift();
  if (ContentRoutingService.isKnownDomain(first)) {
    this.stagingHost = first;
    this.revisionID = parts.shift();
  } else {
    this.stagingHost = config.presented_url_domain();
    this.revisionID = first;
  }

  this.stagingPresentedPath = '/' + parts.join('/');
};

Context.prototype._summarize = function (statusCode, message, err) {
  var summary = {
    statusCode,
    message,
    requestURL: this.request.url,
    requestDomain: this.host(),
    requestProtocol: this.protocol(),
    requestHostname: this.request.hostname,
    requestIP: this.request.ip,
    requestReferer: this.request.get('Referer'),
    requestUserAgent: this.request.get('User-Agent'),
    totalReqDuration: Date.now() - this.startTimestamp
  };

  if (this.contentId !== null) {
    summary.contentID = this.contentId;
  }

  if (this.templatePath !== null) {
    summary.templatePath = this.templatePath;
  }

  if (this.contentReqDuration !== null) {
    summary.contentReqDuration = this.contentReqDuration;
  }

  if (this.templateRenderDuration !== null) {
    summary.templateRenderDuration = this.templateRenderDuration;
  }

  if (this.revisionID) {
    summary.revisionID = this.revisionID;
  }

  if (this.stagingPresentedPath) {
    summary.stagingPresentedPath = this.stagingPresentedPath;
  }

  if (err) {
    summary.errMessage = err.message;
    summary.stack = err.stack;
  }

  return summary;
};

Context.prototype.presentedPath = function () {
  return this.stagingPresentedPath || this.request.path;
};

Context.prototype.host = function () {
  return this.stagingHost || config.presented_url_domain() || this.request.get('Host');
};

Context.prototype.protocol = function () {
  return config.presented_url_proto() || this.request.protocol;
};

Context.prototype.send = function (body) {
  this.response.send(body);
  logger.info(this._summarize(200, 'Successful request'));
};

Context.prototype.setAssets = function (assets) {
  this.assets = assets;
};

Context.prototype.handleError = function (err) {
  var original = err;
  logger.debug(err);
  var code = err.statusCode || 500;
  if (err.statusCode && err.statusCode.toString() === '404') {
    code = 404;
  }

  var options = {
    templatePath: code.toString(),
    assets: this.assets,
    content: {}
  };

  TemplateService.render(this, options, function (err, responseBody) {
    if (err) {
      logger.error("I couldn't render an error template. I'm freaking out!", err);
      responseBody = "Er, I was going to render an error template, but I couldn't.";
    }

    this.response.status(code).send(responseBody);

    if (code >= 500) {
      logger.warn(this._summarize(code, 'Internal error', original));
    } else {
      logger.info(this._summarize(code, 'Request error'));
    }
  }.bind(this));
};

module.exports = Context;
