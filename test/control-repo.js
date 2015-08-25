var before = require('./helpers/before'),
  config = require('../src/config');

config.configure(before.settings);

var fs = require('fs'),
  path = require('path'),
  request = require('supertest'),
  nock = require('nock'),
  mockfs = require('mock-fs'),
  server = require('../src/server'),
  PathService = require('../src/services/path'),
  NunjucksService = require('../src/services/nunjucks');

nock.enableNetConnect('127.0.0.1');

describe('[control-repo] the app', function () {
  beforeEach(function () {
    config.configure(before.settings);
    NunjucksService.clearEnvironments();
  });

  afterEach(function () {
    mockfs.restore();
  });

  it('returns a 404 with a nonexistent control repo', function (done) {
    mockfs({
      'test/test-control/templates/deconst.horse': {
        '404.html': 'site 404 page'
      },
    });

    var content = nock('http://content')
      .get('/content/https%3A%2F%2Fgithub.com%2Fdeconst%2Ffake')
      .reply(200, {
        assets: [],
        envelope: {body: 'the page content'}
      });

    request(server.create())
      .get('/')
      .expect(404)
      .expect('site 404 page', done);
  });

  it('returns a 404 with a malformed content config file', function (done) {
    mockfs({
      'test/test-control/config': {
        'content.json': '{notJson: "false"}'
      },
      'test/test-control/templates/deconst.horse': {
        '404.html': 'site 404 page'
      }
    });

    request(server.create())
      .get('/')
      .expect(404)
      .expect('site 404 page', done);
  });

  it('does not require a rewrites.json file', function (done) {
    config.set({
      CONTROL_REWRITES_FILE: 'foo.json'
    });

    var content = nock('http://content')
      .get('/content/https%3A%2F%2Fgithub.com%2Fdeconst%2Ffake')
      .reply(200, {
        assets: [],
        envelope: {body: 'the page content'}
      });

    request(server.create())
      .get('/')
      .expect(200, done);
  });

  it('404 on umnatched domains/hostnames', function (done) {
    config.set({
      PRESENTED_URL_DOMAIN: 'fake-site.dev'
    });

    var content = nock('http://content')
      .get('/content/https%3A%2F%2Fgithub.com%2Fdeconst%2Ffake')
      .reply(200, {
        assets: [],
        envelope: {body: 'the page content'}
      });

    request(server.create())
      .get('/')
      .expect(404, done);
  });
});
