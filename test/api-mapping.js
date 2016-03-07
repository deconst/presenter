'use-strict';
/* globals it describe beforeEach */

const before = require('./helpers/before');

describe('the mapping API', () => {
  beforeEach(before.reconfigure);

  describe('/_api/whereis', () => {
    it('returns the domain and paths of a content ID');
    it('returns multiple results for redundantly mapped content');
    it('returns an empty collection for unknown content IDs');
  });
});
