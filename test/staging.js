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
        assets: [],
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
        assets: [],
        envelope: { body: 'deconst dog content' }
      });

    request(server.create())
      .get('/deconst.dog/build-12345/and-how/')
      .expect(200)
      .expect(/deconst dog content/, done);
  });

  afterEach(before.reconfigure);
});
