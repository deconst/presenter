'use strict';
/* globals it describe beforeEach */
// Unit tests for the ContentRoutingService.

const before = require('./helpers/before');
const expect = require('chai').expect;

const ContentRoutingService = require('../src/services/content/routing');

describe('ContentRoutingService', () => {
  var context = {
    host: () => 'deconst.horse'
  };

  beforeEach(before.reconfigure);
  beforeEach(() => {
    ContentRoutingService.setContentMap({
      'deconst.horse': {
        content: {
          '/prefix/': 'prefix',
          '/one/two/': 'two',
          '/one/': 'one',
          '/without-slash': 'noslash',
          '/empty/': null
        }
      }
    });
  });

  it('recognizes a known domain', () => {
    expect(ContentRoutingService.isKnownDomain('deconst.horse')).to.equal(true);
  });

  it('recognizes an unknown domain', () => {
    expect(ContentRoutingService.isKnownDomain('other.horse')).to.equal(false);
  });

  var shouldMap = function (presentedPath, contentID) {
    return () => expect(ContentRoutingService.getContentId(context, presentedPath)).to.equal(contentID);
  };

  it('returns a sentinel for umapped content',
    shouldMap('/notmapped/', ContentRoutingService.UNMAPPED));

  it('maps by prefix not substring',
    shouldMap('/nope/prefix/other/', ContentRoutingService.UNMAPPED));

  it('maps a presented path to a content ID',
    shouldMap('/prefix/', 'prefix'));

  it('maps a presented path to a content ID by prefix',
    shouldMap('/prefix/something-else', 'prefix/something-else'));

  it('maps presented paths to the longest prefix',
    shouldMap('/one/two/thingy', 'two/thingy'));

  it('does not require a trailing slash on presented paths',
    shouldMap('/without-slash/blah', 'noslash/blah'));

  it('trims trailing slashes from the suffix',
    shouldMap('/without-slash/blah/boo/bar/', 'noslash/blah/boo/bar'));

  it('maps null routes to the empty envelope',
    shouldMap('/empty/', ContentRoutingService.EMPTY_ENVELOPE));

  it('unmaps everything beneath a null route',
    shouldMap('/empty/anythingelse', ContentRoutingService.UNMAPPED));
});
