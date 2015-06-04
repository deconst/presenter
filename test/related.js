// Unit tests for related content retrieval

var before = require("./helpers/before");

before.configure();

var
  request = require("supertest"),
  nock = require("nock"),
  config = require("../src/config");
  server = require("../src/server");

nock.enableNetConnect("127.0.0.1");

describe("related content", function () {

  beforeEach(function () {
    before.configure();
  });

  it("collects presented URLs for related content", function (done) {
    var mapping = nock("http://mapping")
      .get("/at/https%3A%2F%2Fdeconst.horse%2Ffoo%2Fbar%2Fbaz")
      .reply(200, { contentID: "https://github.com/deconst/fake" })
      .get("/url/https%3A%2F%2Fgithub.com%2Fdeconst%2Ffake%2Fone")
      .reply(200, { presentedURL: "https://deconst.horse/one" })
      .get("/url/https%3A%2F%2Fgithub.com%2Fdeconst%2Ffake%2Ftwo")
      .reply(200, { presentedURL: "https://deconst.horse/two" })
      .get("/url/https%3A%2F%2Fgithub.com%2Fdeconst%2Ffake%2Fthree")
      .reply(200, { presentedURL: "https://deconst.horse/three" });

    var content = nock("http://content")
      .get("/content/https%3A%2F%2Fgithub.com%2Fdeconst%2Ffake")
      .reply(200, {
        assets: [],
        envelope: {
          layout_key: "default",
          body: "the page content"
        },
        results: { sample: [
            { contentID: "https://github.com/deconst/fake/one" },
            { contentID: "https://github.com/deconst/fake/two" },
            { contentID: "https://github.com/deconst/fake/three" }
        ] },
        contentID: true
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
      .reply(200, { contentID: "https://github.com/deconst/fake" })
      .get("/url/https%3A%2F%2Fgithub.com%2Fdeconst%2Ffake%2Fone")
      .reply(200, { presentedURL: "https://other.wtf/one" })
      .get("/url/https%3A%2F%2Fgithub.com%2Fdeconst%2Ffake%2Ftwo")
      .reply(200, { presentedURL: "https://other.wtf/two" })
      .get("/url/https%3A%2F%2Fgithub.com%2Fdeconst%2Ffake%2Fthree")
      .reply(200, { presentedURL: "https://other.wtf/three" });

    var content = nock("http://content")
      .get("/content/https%3A%2F%2Fgithub.com%2Fdeconst%2Ffake")
      .reply(200, {
        assets: [],
        envelope: {
          layout_key: "default",
          body: "the page content"
        },
        results: { sample: [
            { contentID: "https://github.com/deconst/fake/one" },
            { contentID: "https://github.com/deconst/fake/two" },
            { contentID: "https://github.com/deconst/fake/three" }
        ] },
        contentID: true
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
