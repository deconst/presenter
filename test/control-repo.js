var before = require('./helpers/before'),
    config = require('../src/config');

config.configure(before.settings);

var fs = require('fs'),
    path = require('path'),
    request = require('supertest'),
    nock = require('nock'),
    mockfs = require('mock-fs'),
    server = require("../src/server");
    PathService = require("../src/services/path");

nock.enableNetConnect("127.0.0.1");

describe('[control-repo] the app', function () {
    beforeEach(function () {
      config.configure(before.settings);
    });

    afterEach(function () {
        mockfs.restore();
    });

    it('returns 500 with a nonexistent control repo', function (done) {
        mockfs({
            'test-control': {}
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
          .expect('system 404 page', done);
    });

    it('returns 500 with a malformed content config file', function (done) {
        mockfs({
            'test-control': {
                'config': {
                    'content.json': '{notJson: "false"}'
                }
            }
        });

        request(server.create())
          .get('/')
          .expect(500, done);
    });

    it('does not require a rewrites.json file', function (done) {
        config.set({
            CONTROL_REWRITES_FILE: 'foo.json'
        });

        console.log(config.control_rewrites_file());

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
