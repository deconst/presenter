'use strict';
// Handler to assemble a specific piece of static content.

const url = require('url');
const async = require('async');
const cheerio = require('cheerio');
const config = require('../config');
const logger = require('../server/logging').logger;
const Context = require('../helpers/context');
const TemplateService = require('../services/template');
const TemplateRoutingService = require('../services/template/routing');
const ContentService = require('../services/content');
const ContentRoutingService = require('../services/content/routing');
const ContentFilterService = require('../services/content/filter');
const ControlService = require('../services/control');

// Register content filters.

ContentFilterService.add(function (input, next) {
  let context = input.context;
  let content = input.content;

  // Match nunjucks-like "{{ to('') }}" directives that are used to defer rendering of presented URLs
  // until presenter-time.
  const urlDirectiveRx = /\{\{\s*to\('([^']+)'\)\s*\}\}/g;

  // Replace any "{{ to() }}" directives with the appropriate presented URL.
  if (content.envelope && content.envelope.body) {
    content.envelope.body = content.envelope.body.replace(
      urlDirectiveRx,
      (match, contentID) => {
        // Force non-staging presented URLs, even in staging mode.
        const original = ContentRoutingService.getPresentedUrl(context, contentID, true);
        const parsed = url.parse(original);

        logger.debug('Presented URL for content ID', {
          contentID,
          presentedURL: parsed
        });

        if (parsed.host === context.host()) {
          // Link within this domain. Convert to a root-relative link instead.
          delete parsed.protocol;
          delete parsed.hostname;
          delete parsed.host;
          delete parsed.port;
          parsed.slashes = false;
        }

        const final = url.format(parsed);

        logger.debug('Replacing to() directive', { match, contentID, destination: final });
        return final;
      }
    );
  }

  return next();
});

ContentFilterService.add(function (input, next) {
  let context = input.context;
  let content = input.content;

  // Locate the URLs for the content IDs of any next and previous links included in the
  // document.
  if (content.next && content.next.contentID && !content.next.url) {
    content.next.url = ContentRoutingService.getPresentedUrl(context, content.next.contentID);
  }

  if (content.previous && content.previous.contentID && !content.previous.url) {
    content.previous.url = ContentRoutingService.getPresentedUrl(context, content.previous.contentID);
  }

  return next();
});

let retargetStagingLinks = function (context, renderedContent) {
  let $ = cheerio.load(renderedContent);

  $('a').each((i, element) => {
    let e = $(element);
    let target = e.attr('href');
    if (target) {
      let targetURL = url.parse(target);

      if (targetURL.scheme && targetURL.scheme !== 'http' && targetURL.scheme !== 'https') {
        // URL is a non-HTTP protocol. Don't touch it.
        return;
      }

      if (targetURL.hostname && !ContentRoutingService.isKnownDomain(targetURL.hostname)) {
        // URL is an absolute URL to a non-cluster destination.
        return;
      }

      if (targetURL.pathname === null) {
        // URL is a fragment-only URL.
        // Even url.parse('https://rackspace.com') produces a pathname of '/'.
        return;
      }

      let parts = targetURL.pathname.split('/');

      if (parts[0] !== '') {
        // URL is a non-root-relative URL.
        return;
      }

      parts.shift();
      parts.unshift(context.revisionID);

      if (targetURL.hostname) {
        // URL is an absolute URL to an on-cluster destination.
        if (targetURL.hostname !== config.presented_url_domain()) {
          parts.unshift(targetURL.hostname);
        }

        targetURL.protocol = null;
        targetURL.slashes = false;
        targetURL.host = null;
        targetURL.hostname = null;
      } else if (context.host() !== config.presented_url_domain()) {
        // URL is a root-relative URL and the current staging host is non-default.

        parts.unshift(context.host());
      }

      targetURL.pathname = '/' + parts.join('/');

      e.attr('href', url.format(targetURL));
    }
  });

  return $.html();
};

module.exports = function (req, res) {
  const context = new Context(req, res);

  const contentId = ContentRoutingService.getContentId(context);
  context.contentId = contentId;

  // Note that each function returns errors as a .err attribute of its results object rather than
  // as the err parameter to its callback. This is so that all calls are guaranteed to complete
  // before the final callback is invoked, even if one or more produces an error, and assets will
  // be available.
  let capturedError = null;

  let content = null;
  let assets = null;
  let addendaContent = null;
  let filteredContent = null;
  let filteredAddendaContent = null;
  let renderedContent = null;

  const fetchEnvelope = (cb) => {
    ContentService.get(context, contentId, {}, (err, response) => {
      if (err) {
        capturedError = err;
        return cb(null);
      }

      content = response;
      cb(null);
    });
  };

  const fetchAssets = (cb) => {
    ContentService.getAssets(context, (err, response) => {
      if (err) {
        logger.warn('Unable to enumerate assets.', {
          errMessage: err.message,
          stack: err.stack
        });

        return cb(null);
      }

      assets = response;
      context.setAssets(assets);
      cb(null);
    });
  };

  const fetchControl = (cb) => {
    ContentService.getControlSHA(context, (err, sha) => {
      if (err) {
        logger.warn('Unable to retrieve control repository SHA.', {
          errMessage: err.message,
          stack: err.stack
        });

        return cb(null);
      }

      // No need to hold up the current request for the control repository update.
      // Kick it off here but don't wait for it to complete.
      if (sha && sha !== ControlService.getControlSHA()) ControlService.update(sha);

      cb(null);
    });
  };

  const fetchAddenda = (cb) => {
    if (!content || !content.envelope || !content.envelope.addenda) return cb(null);
    const addendaSpec = content.envelope.addenda;

    addendaContent = {};

    async.map(Object.keys(addendaSpec), (addendaName, cb0) => {
      let addendaID = addendaSpec[addendaName];

      ContentService.get(context, addendaID, {}, (err, content) => {
        if (err) {
          logger.warn('Unable to fetch addenda', {
            contentID: contentId,
            addendaID,
            addendaName,
            errMessage: err.message,
            stack: err.stack
          });

          return cb0(null);
        }

        if (content) {
          addendaContent[addendaName] = content;
        }

        cb0(null);
      });
    }, cb);
  };

  const fetch = (cb) => {
    async.parallel([fetchEnvelope, fetchAssets, fetchControl], (err) => {
      if (err) return cb(err);
      fetchAddenda(cb);
    });
  };

  const filterEnvelope = (cb) => {
    if (!content) return cb(null);

    const input = { context, content };

    ContentFilterService.filter(input, (err, result) => {
      if (err) return cb(err);

      filteredContent = result.content;
      cb(null);
    });
  };

  const filterAddenda = (cb) => {
    if (!addendaContent) return cb(null);

    filteredAddendaContent = {};

    async.map(Object.keys(addendaContent), (addendaName, cb0) => {
      const input = { context, content: addendaContent[addendaName] };

      ContentFilterService.filter(input, (err, result) => {
        if (err) return cb(err);

        filteredAddendaContent[addendaName] = result.content;
        cb0(null);
      });
    }, cb);
  };

  const filter = (cb) => {
    async.parallel([filterEnvelope, filterAddenda], cb);
  };

  const render = (cb) => {
    if (!content) return cb(null);

    const options = {
      templatePath: TemplateRoutingService.getRoute(context),
      content: filteredContent,
      addenda: filteredAddendaContent,
      assets
    };

    TemplateService.render(context, options, (err, result) => {
      if (err) return cb(err);

      if (config.staging_mode()) {
        result = retargetStagingLinks(context, result);
      }

      renderedContent = result;
      cb(null);
    });
  };

  async.series([fetch, filter, render], (err) => {
    if (err || capturedError) {
      return context.handleError(err || capturedError);
    }

    context.send(renderedContent);
  });
};
