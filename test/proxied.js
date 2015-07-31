// Unit tests for proxied services.

var
    before = require("./helpers/before"),
    config = require('../src/config'),
    NunjucksService = require("../src/services/nunjucks");

config.configure(before.settings);

var
  request = require("supertest"),
  nock = require("nock"),
  server = require("../src/server");

nock.enableNetConnect("127.0.0.1");

describe("proxied services", function () {

  beforeEach(function () {
    config.configure(before.settings);
    NunjucksService.clearEnvironments();
  });

  it("handles proxied content", function (done) {
    var content = nock("http://deconst.dog")
      .get("/")
      .reply(200, "static content");

    request(server.create())
      .get("/proxy")
      .expect(200)
      .expect("static content", done);
  });

  it("handles proxied content in subdirectories", function (done) {
    var content = nock("http://deconst.dog")
      .get("/foo")
      .reply(200, "foo content");

    request(server.create())
      .get("/proxy/foo")
      .expect(200)
      .expect("foo content", done);
  });

  it("preserves headers from the upstream service", function (done) {
    var content = nock("http://deconst.dog")
      .get("/foo")
      .reply(200, "foo content", {
        "Content-Type": "text/plain",
        "X-Some-Header": "neeeeigh"
      });

    request(server.create())
      .get("/proxy/foo")
      .expect(200)
      .expect("Content-Type", "text/plain")
      .expect("X-Some-Header", "neeeeigh")
      .expect("foo content", done);
  });

  it("preserves response status from the upstream service", function (done) {
    var content = nock("http://deconst.dog")
      .get("/foo")
      .reply(409, "NOPE");

    request(server.create())
      .get("/proxy/foo")
      .expect(409)
      .expect("NOPE", done);
  });
});
