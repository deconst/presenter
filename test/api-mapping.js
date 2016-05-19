'use-strict';
/* globals it describe beforeEach */

const before = require('./helpers/before');
const config = require('../src/config');

config.configure(before.settings);

const request = require('supertest');
const server = require('../src/server');
const ControlService = require('../src/services/control');

describe('/_api/whereis', () => {
  beforeEach(before.reconfigure);
  beforeEach((done) => {
    ControlService.load('sha', (ok) => {
      if (!ok) return done(new Error('Control repository load failed'));
      done();
    });
  });

  it('returns the domain and paths of a content ID', (done) => {
    request(server.create())
      .get('/_api/whereis/https%3A%2F%2Fgithub.com%2Fdeconst%2Fsubrepo%2Fsomepath')
      .set('Accept', 'application/json')
      .expect(200)
      .expect({
        mappings: [
          {
            domain: 'deconst.horse',
            path: '/subrepo/somepath/',
            baseContentID: 'https://github.com/deconst/subrepo/',
            basePath: '/subrepo/'
          }
        ]
      }, done);
  });

  it('returns multiple results for redundantly mapped content', (done) => {
    request(server.create())
      .get('/_api/whereis/https%3A%2F%2Fgithub.com%2Fdeconst%2Fredundant')
      .set('Accept', 'application/json')
      .expect(200)
      .expect({
        mappings: [
          {
            domain: 'deconst.horse',
            path: '/redundant/',
            baseContentID: 'https://github.com/deconst/redundant/',
            basePath: '/redundant/'
          },
          {
            domain: 'deconst.horse',
            path: '/multimapped/',
            baseContentID: 'https://github.com/deconst/redundant/',
            basePath: '/multimapped/'
          },
          {
            domain: 'deconst.dog',
            path: '/elsewhere/',
            baseContentID: 'https://github.com/deconst/redundant/',
            basePath: '/elsewhere/'
          }
        ]
      }, done);
  });

  it('correctly handles when one content ID base is a prefix of another', (done) => {
    request(server.create())
      .get('/_api/whereis/https%3A%2F%2Fgithub.com%2Fdeconst%2Fprefix-2.0')
      .set('Accept', 'application/json')
      .expect(200)
      .expect({
        mappings: [
          {
            domain: 'deconst.horse',
            path: '/prefix-2.0/',
            baseContentID: 'https://github.com/deconst/prefix-2.0/',
            basePath: '/prefix-2.0/'
          }
        ]
      }, done);
  });

  it('returns an empty collection for unknown content IDs', (done) => {
    request(server.create())
      .get('/_api/whereis/https%3A%2F%2Fgithub.com%2Fnope%2Fnope')
      .set('Accept', 'application/json')
      .expect(200)
      .expect({
        mappings: []
      }, done);
  });

  it('has a different URL segment based on the configuration', (done) => {
    before.reconfigureWith({ PRESENTER_API_PATH: 'different' })();

    request(server.create())
      .get('/different/whereis/https%3A%2F%2Fgithub.com%2Fdeconst%2Fsubrepo%2Fsomepath')
      .set('Accept', 'application/json')
      .expect(200)
      .expect({
        mappings: [
          {
            domain: 'deconst.horse',
            path: '/subrepo/somepath/',
            baseContentID: 'https://github.com/deconst/subrepo/',
            basePath: '/subrepo/'
          }
        ]
      }, done);
  });
});
