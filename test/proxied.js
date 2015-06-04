// Unit tests for proxied services.

var before = require("./helpers/before");

before.configure();

var
  request = require("supertest"),
  nock = require("nock"),
  server = require("../src/server");

nock.enableNetConnect("127.0.0.1");

describe("proxied services", function () {

  beforeEach(function () {
    before.configure();
  });

  it("handles proxied content", function (done) {
    var mapping = nock("http://mapping")
      .get("/at/https%3A%2F%2Fdeconst.horse%2Ffoo%2Fbar%2Fstatic")
      .reply(200, { proxyTo: "https://deconst.horse/static" });

    var content = nock("https://deconst.horse")
      .get("/static")
      .reply(200, "static content");

    request(server.create())
      .get("/foo/bar/static")
      .expect(200)
      .expect("static content", done);
  });

  it("preserves headers from the upstream service", function (done) {
    var mapping = nock("http://mapping")
      .get("/at/https%3A%2F%2Fdeconst.horse%2Ffoo%2Fbar%2Fstatic")
      .reply(200, { proxyTo: "https://upstream.horse/service" });

    var content = nock("https://upstream.horse")
      .get("/service")
      .reply(200, "static content", {
        "Content-Type": "text/plain",
        "X-Some-Header": "neeeeigh"
      });

    request(server.create())
      .get("/foo/bar/static")
      .expect(200)
      .expect("Content-Type", "text/plain")
      .expect("X-Some-Header", "neeeeigh")
      .expect("static content", done);
  });

  it("preserves response status from the upstream service", function (done) {
    var mapping = nock("http://mapping")
      .get("/at/https%3A%2F%2Fdeconst.horse%2Ffoo%2Fbar%2Fstatic")
      .reply(200, { proxyTo: "https://upstream.horse/service" });

    var content = nock("https://upstream.horse")
      .get("/service")
      .reply(409, "NOPE");

    request(server.create())
      .get("/foo/bar/static")
      .expect(409)
      .expect("NOPE", done);
  });

});
