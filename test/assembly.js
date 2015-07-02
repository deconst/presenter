// Unit tests for page assembly.

var before = require('./helpers/before'),
    config = require('../src/config');

config.configure(before.settings);

var
  request = require('supertest'),
  nock = require('nock'),
  server = require('../src/server');

nock.enableNetConnect('127.0.0.1');

describe('page assembly', function () {

  beforeEach(function () {
    config.configure(before.settings);
  });

  it('assembles a page', function (done) {
    var content = nock('http://content')
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
    var content = nock('http://content')
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
    var content = nock('http://content')
      .get('/content/https%3A%2F%2Fgithub.com%2Fdeconst%2Ffake')
      .reply(404);

    request(server.create())
      .get('/')
      .expect(404)
      .expect(/user-defined 404 template/, done);
  });


  it('passes other failing status codes through', function (done) {
    var content = nock('http://content')
      .get('/content/https%3A%2F%2Fgithub.com%2Fdeconst%2Ffake')
      .reply(409);

    request(server.create())
      .get('/')
      .expect(409, done);
  });
});
