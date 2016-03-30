'use strict';
/* globals it describe afterEach */
// Unit tests for the configuration system.

const expect = require('chai').expect;
const config = require('../src/config');
const before = require('./helpers/before');

describe('config', () => {
  it('reads configuration values from the environment', () => {
    config.configure({
      CONTROL_REPO_PATH: './test/test-control',
      CONTENT_SERVICE_URL: 'https://content',
      PRESENTED_URL_PROTO: 'http',
      PRESENTED_URL_DOMAIN: 'deconst.horse',
      PRESENTER_API_PATH: 'something',
      PUBLIC_URL_PROTO: 'https',
      PUBLIC_URL_DOMAIN: 'localhost',
      PRESENTER_LOG_LEVEL: 'debug',
      STAGING_MODE: 'true'
    });

    expect(config.content_service_url()).to.equal('https://content');
    expect(config.presented_url_proto()).to.equal('http');
    expect(config.presented_url_domain()).to.equal('deconst.horse');
    expect(config.presenter_api_path()).to.equal('something');
    expect(config.public_url_proto()).to.equal('https');
    expect(config.public_url_domain()).to.equal('localhost');
    expect(config.log_level()).to.equal('debug');
    expect(config.staging_mode()).to.equal(true);
  });

  it('requires service URLs', () => {
    expect(() => {
      config.configure({});
    }).to.throw(Error, /Inadequate configuration/);
  });

  it('defaults the log level', () => {
    config.configure({
      CONTROL_REPO_PATH: './test/test-control',
      CONTENT_SERVICE_URL: 'https://content'
    });

    expect(config.log_level()).to.equal('info');
  });

  it('normalizes service URLs', () => {
    config.configure({
      CONTROL_REPO_PATH: './test/test-control',
      CONTENT_SERVICE_URL: 'https://content/'
    });

    expect(config.content_service_url()).to.equal('https://content');
  });

  afterEach(before.reconfigure);
});
