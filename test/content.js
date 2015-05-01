// Unit tests for the content endpoint.

var
  request = require("supertest"),
  nock = require("nock"),
  config = require("../src/config"),
  server = require("../src/server");

nock.enableNetConnect("127.0.0.1");

describe("/*", function () {
  beforeEach(function () {
    config.configure({
      MAPPING_SERVICE_URL: "http://mapping",
      CONTENT_SERVICE_URL: "http://content",
      LAYOUT_SERVICE_URL: "http://layout",
      PRESENTED_URL_DOMAIN: "deconst.horse"
    });
  });

  it("assembles a page", function (done) {
    var mapping = nock("http://mapping")
      .get("/at/https%3A%2F%2Fdeconst.horse%2Ffoo%2Fbar%2Fbaz")
      .reply(200, { "content-id": "https://github.com/deconst/fake" });

    var content = nock("http://content")
      .get("/content/https%3A%2F%2Fgithub.com%2Fdeconst%2Ffake")
      .reply(200, {
        assets: [],
        envelope: { body: "the page content" }
      });

    var layout = nock("http://layout")
      .get("/https%3A%2F%2Fdeconst.horse%2Ffoo%2Fbar%2Fbaz/default")
      .reply(200, "Rendered {{{ envelope.body }}} with a layout");

    request(server.create())
      .get("/foo/bar/baz")
      .expect(200)
      .expect("Content-Type", /html/)
      .expect("Rendered the page content with a layout", done);
  });
});
