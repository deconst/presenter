/* globals it describe beforeEach */
// Unit tests for page assembly.

var before = require('./helpers/before');
var config = require('../src/config');

config.configure(before.settings);

var request = require('supertest');
var nock = require('nock');
var server = require('../src/server');
var ControlService = require('../src/services/control');

nock.enableNetConnect('127.0.0.1');

describe('page assembly', function () {
  beforeEach(function (done) {
    config.configure(before.settings);

    ControlService.load(function (ok) {
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
      .reply(200, {})
      .get('/content/https%3A%2F%2Fgithub.com%2Fdeconst%2Ffake')
      .reply(404);

    request(server.create())
      .get('/')
      .expect(404)
      .expect(/user-defined 404 template/, done);
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
});
