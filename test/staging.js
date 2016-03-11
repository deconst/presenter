'use strict';
/* globals it describe beforeEach afterEach */
// Unit tests to exercise staging mode

const before = require('./helpers/before');
const config = require('../src/config');

config.configure(before.settings);

const request = require('supertest');
const nock = require('nock');
const server = require('../src/server');
const ControlService = require('../src/services/control');

describe('staging mode', () => {
  beforeEach(before.reconfigureWith({
    PRESENTED_URL_DOMAIN: 'deconst.horse',
    STAGING_MODE: 'true'
  }));
  beforeEach((done) => {
    ControlService.load((ok) => {
      if (!ok) return done(new Error('Control repository load failed'));
      done();
    });
  });

  it('understands the revision ID path segment', (done) => {
    nock('http://content')
      .get('/control')
      .reply(200, { sha: null })
      .get('/assets')
      .reply(200, {})
      .get('/content/https%3A%2F%2Fgithub.com%2Fbuild-12345%2Fdeconst%2Ffake%2Fsubpath')
      .reply(200, {
        envelope: { body: 'subpath content' }
      });

    request(server.create())
      .get('/build-12345/subpath/')
      .expect(200)
      .expect(/subpath content/, done);
  });

  it('recognizes a non-default host path segment', (done) => {
    nock('http://content')
      .get('/control')
      .reply(200, { sha: null })
      .get('/assets')
      .reply(200, {})
      .get('/content/https%3A%2F%2Fgithub.com%2Fbuild-12345%2Fdeconst-dog%2Ffake%2Fand-how')
      .reply(200, {
        envelope: { body: 'deconst dog content' }
      });

    request(server.create())
      .get('/deconst.dog/build-12345/and-how/')
      .expect(200)
      .expect(/deconst dog content/, done);
  });

  describe('link manipulation', () => {
    it('prepends revision ID to root-relative links', (done) => {
      nock('http://content')
        .get('/control')
        .reply(200, { sha: null })
        .get('/assets')
        .reply(200, {})
        .get('/content/https%3A%2F%2Fgithub.com%2Fbuild-12345%2Fdeconst%2Ffake%2Fsubpath')
        .reply(200, {
          envelope: { body: 'with <a href="/foo/bar/baz/">relative link</a>' }
        });

      request(server.create())
        .get('/build-12345/subpath/')
        .expect(200)
        .expect(/<a href="\/build-12345\/foo\/bar\/baz\/">/, done);
    });

    it('prepends revision ID to absolute links', (done) => {
      nock('http://content')
        .get('/control')
        .reply(200, { sha: null })
        .get('/assets')
        .reply(200, {})
        .get('/content/https%3A%2F%2Fgithub.com%2Fbuild-12345%2Fdeconst%2Ffake%2Fsubpath')
        .reply(200, {
          envelope: { body: 'with <a href="https://deconst.horse/huh/what/">absolute link</a>' }
        });

      request(server.create())
        .get('/build-12345/subpath/')
        .expect(200)
        .expect(/<a href="\/build-12345\/huh\/what\/">/, done);
    });

    it('prepends host and revision ID to outgoing root-relative links for non-default hosts', (done) => {
      nock('http://content')
        .get('/control')
        .reply(200, { sha: null })
        .get('/assets')
        .reply(200, {})
        .get('/content/https%3A%2F%2Fgithub.com%2Fbuild-12345%2Fdeconst-dog%2Ffake%2Fand-how')
        .reply(200, {
          envelope: { body: 'has <a href="/aaa/bbb/">relative link</a>' }
        });

      request(server.create())
        .get('/deconst.dog/build-12345/and-how/')
        .expect(200)
        .expect(/<a href="\/deconst.dog\/build-12345\/aaa\/bbb\/">/, done);
    });

    it('prepends host and revision ID to outgoing absolute links for non-default hosts', (done) => {
      nock('http://content')
        .get('/control')
        .reply(200, { sha: null })
        .get('/assets')
        .reply(200, {})
        .get('/content/https%3A%2F%2Fgithub.com%2Fbuild-12345%2Fdeconst%2Ffake%2Fyuppers')
        .reply(200, {
          envelope: { body: 'has <a href="https://deconst.dog/aaa/bbb/">absolute link</a>' }
        });

      request(server.create())
        .get('/build-12345/yuppers/')
        .expect(200)
        .expect(/<a href="\/deconst.dog\/build-12345\/aaa\/bbb\/">/, done);
    });

    it('leaves non-root relative links alone', (done) => {
      nock('http://content')
        .get('/control')
        .reply(200, { sha: null })
        .get('/content/https%3A%2F%2Fgithub.com%2Fbuild-12345%2Fdeconst%2Ffake%2Fabc')
        .reply(200, { envelope: { body: 'with <a href="baz/">relative link</a>' } });

      request(server.create())
        .get('/build-12345/abc/')
        .expect(200)
        .expect(/<a href="baz\/">/, done);
    });

    it('leaves fragment-only links alone', (done) => {
      nock('http://content')
        .get('/control')
        .reply(200, { sha: null })
        .get('/content/https%3A%2F%2Fgithub.com%2Fbuild-12345%2Fdeconst%2Ffake%2Fabc')
        .reply(200, {
          envelope: { body: 'with <a href="#whatever">fragment link</a>' }
        });

      request(server.create())
        .get('/build-12345/abc/')
        .expect(200)
        .expect(/<a href="#whatever">/, done);
    });

    it('leaves mailto links alone', (done) => {
      nock('http://content')
        .get('/control')
        .reply(200, { sha: null })
        .get('/content/https%3A%2F%2Fgithub.com%2Fbuild-12345%2Fdeconst%2Ffake%2Fabc')
        .reply(200, {
          envelope: { body: 'with <a href="mailto:me@wherever.com">mailto link</a>' }
        });

      request(server.create())
        .get('/build-12345/abc/')
        .expect(200)
        .expect(/<a href="mailto:me@wherever\.com">/, done);
    });

    it('leaves absolute links off-cluster alone', (done) => {
      nock('http://content')
        .get('/control')
        .reply(200, { sha: null })
        .get('/content/https%3A%2F%2Fgithub.com%2Fbuild-12345%2Fdeconst%2Ffake%2Fzzz')
        .reply(200, {
          envelope: { body: 'with <a href="https://github.com/deconst">absolute link off-cluster</a>' }
        });

      request(server.create())
        .get('/build-12345/zzz/')
        .expect(200)
        .expect(/<a href="https:\/\/github\.com\/deconst">/, done);
    });

    it('replaces links from templates, too!', (done) => {
      nock('http://content')
        .get('/control')
        .reply(200, { sha: null })
        .get('/content/https%3A%2F%2Fgithub.com%2Fbuild-12345%2Fdeconst%2Ffake%2Fwith-template-link')
        .reply(200, { envelope: { body: 'irrelevant' } });

      request(server.create())
        .get('/build-12345/with-template-link/')
        .expect(200)
        .expect(/<a href="\/build-12345\/some\/path\/here\/#fragment">/, done);
    });
  });

  describe('/_api/whereis', () => {
    it('includes revision IDs in mappings', (done) => {
      request(server.create())
        .get('/_api/whereis/https%3A%2F%2Fgithub.com%2Fbuild-1234%2Fdeconst%2Fsubrepo%2Ffoo%2F')
        .set('Accept', 'application/json')
        .expect(200)
        .expect({
          mappings: [ {
            domain: 'deconst.horse',
            baseContentID: 'https://github.com/build-1234/deconst/subrepo/',
            basePath: '/build-1234/subrepo/',
            path: '/build-1234/subrepo/foo/'
          } ]
        }, done);
    });

    it('includes non-default host segments', (done) => {
      request(server.create())
        .get('/_api/whereis/https%3A%2F%2Fgithub.com%2Fbuild-abc%2Fdeconst-dog%2Ffake%2F')
        .set('Accept', 'application/json')
        .expect(200)
        .expect({
          mappings: [ {
            domain: 'deconst.dog',
            baseContentID: 'https://github.com/build-abc/deconst-dog/fake/',
            basePath: '/deconst.dog/build-abc/',
            path: '/deconst.dog/build-abc/'
          } ]
        }, done);
    });
  });

  describe('robots.txt', () => {
    it('always denies everything', (done) => {
      request(server.create())
        .get('/robots.txt')
        .expect(200)
        .expect('Content-type', 'text/plain; charset=utf-8')
        .expect('User-agent: *\nDisallow: /\n', done);
    });
  });

  afterEach(before.reconfigure);
});
