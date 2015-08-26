/* globals it describe */
// Unit tests for the configuration system.

var expect = require('chai').expect;
var config = require('../src/config');

describe('config', function () {
  it('reads configuration values from the environment', function () {
    config.configure({
      CONTROL_REPO_PATH: './test/test-control',
      CONTENT_SERVICE_URL: 'https://content',
      PRESENTED_URL_PROTO: 'http',
      PRESENTED_URL_DOMAIN: 'deconst.horse',
      PUBLIC_URL_PROTO: 'https',
      PUBLIC_URL_DOMAIN: 'localhost',
      PRESENTER_LOG_LEVEL: 'debug'
    });

    expect(config.content_service_url()).to.equal('https://content');
    expect(config.presented_url_proto()).to.equal('http');
    expect(config.presented_url_domain()).to.equal('deconst.horse');
    expect(config.public_url_proto()).to.equal('https');
    expect(config.public_url_domain()).to.equal('localhost');
    expect(config.log_level()).to.equal('debug');
  });

  it('requires service URLs', function () {
    expect(function () {
      config.configure({});
    }).to.throw(Error, /Inadequate configuration/);
  });

  it('defaults the log level', function () {
    config.configure({
      CONTROL_REPO_PATH: './test/test-control',
      CONTENT_SERVICE_URL: 'https://content'
    });

    expect(config.log_level()).to.equal('info');
  });

  it('normalizes service URLs', function () {
    config.configure({
      CONTROL_REPO_PATH: './test/test-control',
      CONTENT_SERVICE_URL: 'https://content/'
    });

    expect(config.content_service_url()).to.equal('https://content');
  });
});
