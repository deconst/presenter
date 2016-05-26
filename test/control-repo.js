/* globals it describe beforeEach afterEach */

var before = require('./helpers/before');
var config = require('../src/config');

config.configure(before.settings);

var request = require('supertest');
var nock = require('nock');
var mockfs = require('mock-fs');
var server = require('../src/server');
var NunjucksService = require('../src/services/nunjucks');
var ControlService = require('../src/services/control');

nock.enableNetConnect('127.0.0.1');

var mockControl = function (mfs, callback) {
  if (mfs !== null) mockfs(mfs);

  ControlService.load('sha', (ok) => {
    if (mfs !== null) mockfs.restore();

    if (!ok) {
      throw new Error('Unable to load control repository');
    }

    callback();
  });
};

describe('[control-repo] the app', function () {
  beforeEach(function (done) {
    config.configure(before.settings);
    NunjucksService.clearEnvironments();

    NunjucksService.initialize(done);
  });

  afterEach(function () {
    mockfs.restore();
  });

  it('returns a 404 with a nonexistent control repo', function (done) {
    mockControl({}, function () {
      nock('http://content')
        .get('/control')
        .reply(200, {
          sha: null
        })
        .get('/content/https%3A%2F%2Fgithub.com%2Fdeconst%2Ffake')
        .reply(200, {
          assets: [],
          envelope: {body: 'the page content'}
        });

      request(server.create())
        .get('/')
        .expect(404)
        .expect(/Page Not Found/, done);
    });
  });

  it('does not require a rewrites.json file', function (done) {
    config.set({
      CONTROL_REWRITES_FILE: 'foo.json'
    });

    mockControl(null, function () {
      nock('http://content')
        .get('/control')
        .reply(200, {
          sha: null
        })
        .get('/content/https%3A%2F%2Fgithub.com%2Fdeconst%2Ffake')
        .reply(200, {
          assets: [],
          envelope: {body: 'the page content'}
        });

      request(server.create())
        .get('/')
        .expect(200, done);
    });
  });

  it('returns a 404 on unmatched domains', function (done) {
    config.set({
      PRESENTED_URL_DOMAIN: 'fake-site.dev'
    });

    mockControl(null, function () {
      request(server.create())
        .get('/')
        .expect(404, done);
    });
  });

  it('returns a redirect to a different hostname', function (done) {
    mockControl(null, function () {
      request(server.create())
        .get('/different-host/some-path/')
        .expect('Location', 'https://stable.horse/some-path/')
        .expect(301, done);
    });
  });

  it('redirects correctly with URL-encoded characters in the path', function (done) {
    mockControl(null, function () {
      request(server.create())
        .get('/different-host/some%e2text/')
        .expect('Location', 'https://stable.horse/some%e2text/')
        .expect(301, done);
    });
  });

  it('redirects correctly with invalid URL-encoded characters', function (done) {
    mockControl(null, function () {
      request(server.create())
        .get('/different-host/%zz/')
        .expect('Location', 'https://stable.horse/%zz/')
        .expect(301, done);
    });
  });
});
