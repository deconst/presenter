// Unit tests for the version endpoint.

var
  request = require("supertest"),
  expect = require("chai").expect,
  config = require("../src/config"),
  server = require("../src/server"),
  info = require("../package.json");

describe("/version", function () {
  it("reports the running application version", function (done) {
    request(server.create())
      .get("/version")
      .expect(200)
      .expect("Content-Type", /json/)
      .expect(function (res) {
        expect(res.body.service).to.equal(info.name);
        expect(res.body.version).to.equal(info.version);
        expect(res.body.commit).to.have.length(7);
      })
      .end(done);
  });
});
