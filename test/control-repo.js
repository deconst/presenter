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

  ControlService.load(function () {
    if (mfs !== null) mockfs.restore();
    callback();
  });
};

describe('[control-repo] the app', function () {
  beforeEach(function () {
    config.configure(before.settings);
    NunjucksService.clearEnvironments();
  });

  afterEach(function () {
    mockfs.restore();
  });

  it('returns a 404 with a nonexistent control repo', function (done) {
    mockControl({}, function () {
      nock('http://content')
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

  it('returns a 404 with a malformed content config file', function (done) {
    var mfs = {
      'test/test-control/config': {
        'content.json': '{notJson: "false"}'
      }
    };

    mockControl(mfs, function () {
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

  it('returns a 404 on umnatched domains', function (done) {
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
});
