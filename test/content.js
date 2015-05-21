// Unit tests for the content endpoint.

var config = require("../src/config");

var settings = {
  MAPPING_SERVICE_URL: "http://mapping",
  CONTENT_SERVICE_URL: "http://content",
  LAYOUT_SERVICE_URL: "http://layout",
  PRESENTED_URL_PROTO: "https",
  PRESENTED_URL_DOMAIN: "deconst.horse",
  PRESENTER_LOG_LEVEL: process.env.PRESENTER_LOG_LEVEL
};

config.configure(settings);

var
  request = require("supertest"),
  nock = require("nock"),
  server = require("../src/server");

nock.enableNetConnect("127.0.0.1");

describe("/*", function () {
  beforeEach(function () {
    config.configure(settings);
  });

  it("assembles a page", function (done) {
    var mapping = nock("http://mapping")
      .get("/at/https%3A%2F%2Fdeconst.horse%2Ffoo%2Fbar%2Fbaz")
      .reply(200, { "content-id": "https://github.com/deconst/fake" });

    var content = nock("http://content")
      .get("/content/https%3A%2F%2Fgithub.com%2Fdeconst%2Ffake")
      .reply(200, {
        assets: [],
        envelope: { body: "the page content" },
        "content-id": true
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

  it("handles static content", function (done) {
    var mapping = nock("http://mapping")
    .get("/at/https%3A%2F%2Fdeconst.horse%2Ffoo%2Fbar%2Fstatic")
    .reply(200, { "proxy-to": "https://deconst.horse/static" });

    var content = nock("https://deconst.horse")
    .get("/static")
    .reply(200, "static content");

    request(server.create())
    .get("/foo/bar/static")
    .expect(200)
    .expect("static content", done);
  });

  it("returns a 404 when the content ID cannot be found", function (done) {
    var mapping = nock("http://mapping")
      .get("/at/https%3A%2F%2Fdeconst.horse%2Ffoo%2Fbar%2Fbaz")
      .reply(200, { "content-id": "https://github.com/deconst/fake" });

    var content = nock("http://content")
      .get("/content/https%3A%2F%2Fgithub.com%2Fdeconst%2Ffake")
      .reply(404);

    var layout = nock("http://layout")
      .get("/error/https%3A%2F%2Fdeconst.horse%2Ffoo%2Fbar%2Fbaz/404")
      .reply(200, "The 404 page");

    request(server.create())
      .get("/foo/bar/baz")
      .expect(404)
      .expect("The 404 page", done);
  })

  it("collects presented URLs for related content", function (done) {
    var mapping = nock("http://mapping")
      .get("/at/https%3A%2F%2Fdeconst.horse%2Ffoo%2Fbar%2Fbaz")
      .reply(200, { "content-id": "https://github.com/deconst/fake" })
      .get("/url/https%3A%2F%2Fgithub.com%2Fdeconst%2Ffake%2Fone")
      .reply(200, { "presented-url": "https://deconst.horse/one" })
      .get("/url/https%3A%2F%2Fgithub.com%2Fdeconst%2Ffake%2Ftwo")
      .reply(200, { "presented-url": "https://deconst.horse/two" })
      .get("/url/https%3A%2F%2Fgithub.com%2Fdeconst%2Ffake%2Fthree")
      .reply(200, { "presented-url": "https://deconst.horse/three" });

    var content = nock("http://content")
      .get("/content/https%3A%2F%2Fgithub.com%2Fdeconst%2Ffake")
      .reply(200, {
        assets: [],
        envelope: { body: "the page content" },
        results: { sample: [
            { contentID: "https://github.com/deconst/fake/one" },
            { contentID: "https://github.com/deconst/fake/two" },
            { contentID: "https://github.com/deconst/fake/three" }
        ] },
        "content-id": true
      });

    var layout = nock("http://layout")
      .get("/https%3A%2F%2Fdeconst.horse%2Ffoo%2Fbar%2Fbaz/default")
      .reply(200, "URLs: {{#each results.sample}}<{{url}}>{{/each}}");

    var rendered = "URLs: <https://deconst.horse/one>" +
      "<https://deconst.horse/two><https://deconst.horse/three>";

    request(server.create())
      .get("/foo/bar/baz")
      .expect(200)
      .expect("Content-Type", /html/)
      .expect(rendered, done);
  });

  it("transforms related content URLs with a presented domain and protocol", function (done) {
    config.configure({
      MAPPING_SERVICE_URL: "http://mapping",
      CONTENT_SERVICE_URL: "http://content",
      LAYOUT_SERVICE_URL: "http://layout",
      PRESENTED_URL_PROTO: "https",
      PRESENTED_URL_DOMAIN: "deconst.horse",
      PUBLIC_URL_PROTO: "http",
      PUBLIC_URL_DOMAIN: "localhost",
      PRESENTER_LOG_LEVEL: process.env.PRESENTER_LOG_LEVEL
    });

    var mapping = nock("http://mapping")
      .get("/at/https%3A%2F%2Fdeconst.horse%2Ffoo%2Fbar%2Fbaz")
      .reply(200, { "content-id": "https://github.com/deconst/fake" })
      .get("/url/https%3A%2F%2Fgithub.com%2Fdeconst%2Ffake%2Fone")
      .reply(200, { "presented-url": "https://other.wtf/one" })
      .get("/url/https%3A%2F%2Fgithub.com%2Fdeconst%2Ffake%2Ftwo")
      .reply(200, { "presented-url": "https://other.wtf/two" })
      .get("/url/https%3A%2F%2Fgithub.com%2Fdeconst%2Ffake%2Fthree")
      .reply(200, { "presented-url": "https://other.wtf/three" });

    var content = nock("http://content")
      .get("/content/https%3A%2F%2Fgithub.com%2Fdeconst%2Ffake")
      .reply(200, {
        assets: [],
        envelope: { body: "the page content" },
        results: { sample: [
            { contentID: "https://github.com/deconst/fake/one" },
            { contentID: "https://github.com/deconst/fake/two" },
            { contentID: "https://github.com/deconst/fake/three" }
        ] },
        "content-id": true
      });

    var layout = nock("http://layout")
      .get("/https%3A%2F%2Fdeconst.horse%2Ffoo%2Fbar%2Fbaz/default")
      .reply(200, "URLs: {{#each results.sample}}<{{url}}>{{/each}}");

    var rendered = "URLs: <http://localhost/one>" +
      "<http://localhost/two><http://localhost/three>";

    request(server.create())
      .get("/foo/bar/baz")
      .expect(200)
      .expect("Content-Type", /html/)
      .expect(rendered, done);
  });

});
