'use strict';

/* globals it describe beforeEach */
// Unit tests for page assembly.

const before = require('./helpers/before');
const config = require('../src/config');

config.configure(before.settings);

const request = require('supertest');
const nock = require('nock');
const server = require('../src/server');
const ControlService = require('../src/services/control');

nock.enableNetConnect('127.0.0.1');

describe('page assembly', function () {
  beforeEach(function (done) {
    config.configure(before.settings);

    ControlService.load('sha', (ok) => {
      if (!ok) {
        return done(new Error('Control repository load failed'));
      }

      done();
    });
  });

  it('assembles a page', function (done) {
    nock('http://content')
      .get('/control')
      .reply(200, { sha: null })
      .get('/assets')
      .reply(200, {})
      .get('/content/https%3A%2F%2Fgithub.com%2Fdeconst%2Ffake')
      .reply(200, {
        assets: [],
        envelope: { body: 'the page content' }
      });

    request(server.create())
      .get('/')
      .expect(200)
      .expect(/the page content/, done);
  });

  it('ignores empty URL segments', function (done) {
    nock('http://content')
      .get('/control')
      .reply(200, { sha: null })
      .get('/assets')
      .reply(200, {})
      .get('/content/https%3A%2F%2Fgithub.com%2Fdeconst%2Ffake%2Ffoo')
      .reply(200, {
        assets: [],
        envelope: { body: 'the page content' }
      });

    request(server.create())
      .get('/////foo')
      .expect(200)
      .expect(/the page content/, done);
  });

  it('returns the user-defined 404 template', function (done) {
    nock('http://content')
      .get('/control')
      .reply(200, { sha: null })
      .get('/assets')
      .reply(200, {
        some_css_url: 'https://cdn.wtf/hooray/main-12345.css'
      })
      .get('/content/https%3A%2F%2Fgithub.com%2Fdeconst%2Ffake')
      .reply(404);

    request(server.create())
      .get('/')
      .expect(404)
      .expect(/https:\/\/cdn.wtf\/hooray\/main-12345.css/)
      .expect(/user-defined 404 template/, done);
  });

  it('returns the user-defined 404 template even after the system 404 template was used', function (done) {
    before.reconfigureWith({
      PRESENTED_URL_DOMAIN: null
    })();

    nock('http://content')
      .get('/control').twice().reply(200, { sha: null })
      .get('/assets').twice().reply(200, {})
      .get('/content/https%3A%2F%2Fgithub.com%2Fdeconst-dog%2Ffake').reply(404)
      .get('/content/https%3A%2F%2Fgithub.com%2Fdeconst%2Ffake').reply(404);

    let s = server.create();

    request(s)
      .get('/').set('Host', 'deconst.dog')
      .expect(404)
      .expect(/Page Not Found/, function (err) {
        if (err) return done(err);

        request(s)
          .get('/').set('Host', 'deconst.horse')
          .expect(404)
          .expect(/user-defined 404 template/, done);
      });
  });

  it('passes other failing status codes through', function (done) {
    nock('http://content')
      .get('/control')
      .reply(200, { sha: null })
      .get('/assets')
      .reply(200, {})
      .get('/content/https%3A%2F%2Fgithub.com%2Fdeconst%2Ffake')
      .reply(409);

    request(server.create())
      .get('/')
      .expect(409, done);
  });

  it('performs a search if requested', function (done) {
    nock('http://content')
      .get('/control')
      .reply(200, { sha: null })
      .get('/assets')
      .reply(200, {})
      .get('/search?q=term&pageNumber=3&perPage=2')
      .reply(200, {
        total: 11,
        results: [
          {
            contentID: 'https://github.com/deconst/fake/one',
            title: 'first',
            excerpt: 'this <em>is</em> result one'
          },
          {
            contentID: 'https://github.com/deconst/fake/two',
            title: 'second',
            excerpt: 'this <em>is</em> result two'
          }
        ]
      });

    request(server.create())
      .get('/search/?notq=term&notpagenum=3&notperpage=2')
      .expect(200)
      .expect(/Total results: 11\b/)
      .expect(/Number of pages: 6\b/)
      .expect(/0: url https:\/\/deconst\.horse\/one\//)
      .expect(/0: title first/)
      .expect(/0: excerpt this <em>is<\/em> result one/)
      .expect(/1: url https:\/\/deconst\.horse\/two\//)
      .expect(/1: title second/)
      .expect(/1: excerpt this <em>is<\/em> result two/, done);
  });

  it('performs a search with default parameters', function (done) {
    nock('http://content')
      .get('/control')
      .reply(200, { sha: null })
      .get('/assets')
      .reply(200, {})
      .get('/search?q=term')
      .reply(200, {
        total: 1,
        results: [
          {
            contentID: 'https://github.com/deconst/fake/one',
            title: 'first',
            excerpt: 'this <em>is</em> result one'
          }
        ]
      });

    request(server.create())
      .get('/searchparams/?q=term')
      .expect(200)
      .expect(/Total results: 1\b/)
      .expect(/Number of pages: 1\b/)
      .expect(/0: url https:\/\/deconst\.horse\/one\//)
      .expect(/0: title first/, done);
  });

  it('performs cross-domain searches', function (done) {
    nock('http://content')
      .get('/control')
      .reply(200, { sha: null })
      .get('/assets')
      .reply(200, {})
      .get('/search?q=term')
      .reply(200, {
        total: 1,
        results: [
          {
            contentID: 'https://github.com/deconst-dog/fake/one',
            title: 'first',
            excerpt: 'this <em>is</em> a cross-domain result'
          }
        ]
      });

    request(server.create())
      .get('/search/?notq=term')
      .expect(200)
      .expect(/0: url https:\/\/deconst\.dog\/one\//)
      .expect(/0: title first/)
      .expect(/0: excerpt this <em>is<\/em> a cross-domain result/, done);
  });

  it('constrains searches by category', function (done) {
    nock('http://content')
      .get('/control')
      .reply(200, { sha: null })
      .get('/assets')
      .reply(200, {})
      .get('/search?q=term&categories%5B0%5D=Abyssinian&categories%5B1%5D=American%20Bobtail')
      .reply(200, {
        total: 1,
        results: [
          {
            contentID: 'https://github.com/deconst/fake/one',
            title: 'first',
            excerpt: 'this <em>is</em> a constrained result'
          }
        ]
      });

    request(server.create())
      .get('/searchcats/?q=term')
      .expect(200)
      .expect(/0: url https:\/\/deconst\.horse\/one\//)
      .expect(/0: title first/)
      .expect(/0: excerpt this <em>is<\/em> a constrained result/, done);
  });

  it('renders a real robots.txt', (done) => {
    nock('http://content')
      .get('/control').reply(200, { sha: null })
      .get('/assets').reply(200, {})
      .get('/content/https%3A%2F%2Fgithub.com%2Fdeconst%2Ffake%2Frobots.txt')
      .reply(200, {
        envelope: { body: 'not hardcoded' }
      });

    request(server.create())
      .get('/robots.txt')
      .expect(200)
      .expect(/not hardcoded/, done);
  });

  it('exposes staging mode to templates', (done) => {
    nock('http://content')
      .get('/control').reply(200, { sha: null })
      .get('/assets').reply(200, {})
      .get('/content/https%3A%2F%2Fgithub.com%2Fdeconst%2Ffake%2Fam-i-staging')
      .reply(200, {
        assets: [],
        envelope: { body: 'the page content' }
      });

    request(server.create())
      .get('/am-i-staging/')
      .expect(200)
      .expect(/not on staging/, done);
  });

  it('substitutes {{ to() }} directives', (done) => {
    nock('http://content')
      .get('/control').reply(200, { sha: null })
      .get('/assets').reply(200, {})
      .get('/content/https%3A%2F%2Fgithub.com%2Fdeconst%2Ffake')
      .reply(200, {
        assets: [],
        envelope: { body: "with a {{ to('https://github.com/deconst/subrepo/some/page') }} reference" }
      });

    request(server.create())
      .get('/')
      .expect(200)
      .expect(/with a https:\/\/deconst\.horse\/subrepo\/some\/page\/ reference/, done);
  });

  it('fetches envelope addenda', (done) => {
    nock('http://content')
      .get('/control').reply(200, { sha: null })
      .get('/assets').reply(200, {})
      .get('/content/https%3A%2F%2Fgithub.com%2Fdeconst%2Ffake%2Foriginal')
      .reply(200, {
        envelope: {
          addenda: { some_name: 'https://github.com/deconst/fake/_other' },
          body: 'original'
        }
      })
      .get('/content/https%3A%2F%2Fgithub.com%2Fdeconst%2Ffake%2F_other')
      .reply(200, {
        envelope: {
          body: 'other'
        }
      });

    request(server.create())
      .get('/original/')
      .expect(200)
      .expect(/addenda: "other"/)
      .expect(/body: "original"/, done);
  });
});
