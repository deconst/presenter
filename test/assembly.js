// Unit tests for page assembly.

var before = require("./helpers/before");

before.configure();

var
  request = require("supertest"),
  nock = require("nock"),
  server = require("../src/server");

nock.enableNetConnect("127.0.0.1");

describe("page assembly", function () {

  beforeEach(function () {
    before.configure();
  });

  it("assembles a page", function (done) {
    var mapping = nock("http://mapping")
      .get("/at/https%3A%2F%2Fdeconst.horse%2Ffoo%2Fbar%2Fbaz")
      .reply(200, { contentID: "https://github.com/deconst/fake" });

    var content = nock("http://content")
      .get("/content/https%3A%2F%2Fgithub.com%2Fdeconst%2Ffake")
      .reply(200, {
        assets: [],
        envelope: { layout_key: "default", body: "the page content" }
      });

    var layout = nock("http://layout")
      .get("/https%3A%2F%2Fdeconst.horse%2Ffoo%2Fbar%2Fbaz/default")
      .reply(200, "Rendered {{{ envelope.body }}} with a layout");

    request(server.create())
      .get("/foo/bar/baz/")
      .expect(200)
      .expect("Content-Type", /html/)
      .expect("Rendered the page content with a layout", done);
  });

  it("supports a null layout_key", function (done) {
    var mapping = nock("http://mapping")
      .get("/at/https%3A%2F%2Fdeconst.horse%2Ffoo%2Fbar%2Fbaz")
      .reply(200, { contentID: "https://github.com/deconst/fake" });

    var content = nock("http://content")
      .get("/content/https%3A%2F%2Fgithub.com%2Fdeconst%2Ffake")
      .reply(200, {
        assets: [],
        envelope: { layout_key: null, body: "only this" }
      });

    request(server.create())
      .get("/foo/bar/baz/")
      .expect(200)
      .expect("Content-Type", /html/)
      .expect("only this", done);
  });

  it("supports a missing layout_key", function (done) {
    var mapping = nock("http://mapping")
      .get("/at/https%3A%2F%2Fdeconst.horse%2Ffoo%2Fbar%2Fbaz")
      .reply(200, { contentID: "https://github.com/deconst/fake" });

    var content = nock("http://content")
      .get("/content/https%3A%2F%2Fgithub.com%2Fdeconst%2Ffake")
      .reply(200, {
        assets: [],
        envelope: { body: "only this" },
        contentID: true
      });

    request(server.create())
      .get("/foo/bar/baz/")
      .expect(200)
      .expect("Content-Type", /html/)
      .expect("only this", done);
  });

  it("respects a content-type from the envelope", function (done) {
    var mapping = nock("http://mapping")
      .get("/at/https%3A%2F%2Fdeconst.horse%2Ffoo%2Fbar%2Fbaz")
      .reply(200, { contentID: "https://github.com/deconst/fake" });

    var content = nock("http://content")
      .get("/content/https%3A%2F%2Fgithub.com%2Fdeconst%2Ffake")
      .reply(200, {
        assets: [],
        envelope: {
          body: "yup",
          content_type: "text/plain"
        }
      });

    request(server.create())
      .get("/foo/bar/baz/")
      .expect(200)
      .expect("Content-Type", /text\/plain/)
      .expect("yup", done);
  });

  it("returns a 404 when the content ID cannot be found", function (done) {
    var mapping = nock("http://mapping")
      .get("/at/https%3A%2F%2Fdeconst.horse%2Ffoo%2Fbar%2Fbaz")
      .reply(200, { contentID: "https://github.com/deconst/fake" });

    var content = nock("http://content")
      .get("/content/https%3A%2F%2Fgithub.com%2Fdeconst%2Ffake")
      .reply(404);

    var layout = nock("http://layout")
      .get("/error/https%3A%2F%2Fdeconst.horse%2Ffoo%2Fbar%2Fbaz/404")
      .reply(200, "The 404 page");

    request(server.create())
      .get("/foo/bar/baz/")
      .expect(404)
      .expect("The 404 page", done);
  });

  it("returns a 404 even when no 404 layout is found", function (done) {
    var mapping = nock("http://mapping")
      .get("/at/https%3A%2F%2Fdeconst.horse%2Ffoo%2Fbar%2Fbaz")
      .reply(200, { contentID: "https://github.com/deconst/fake" });

    var content = nock("http://content")
      .get("/content/https%3A%2F%2Fgithub.com%2Fdeconst%2Ffake")
      .reply(404);

    var layout = nock("http://layout")
      .get("/error/https%3A%2F%2Fdeconst.horse%2Ffoo%2Fbar%2Fbaz/404")
      .reply(404);

    request(server.create())
      .get("/foo/bar/baz/")
      .expect(404, done);
  });

  it("passes other failing status codes through", function (done) {
    var mapping = nock("http://mapping")
      .get("/at/https%3A%2F%2Fdeconst.horse%2Ffoo%2Fbar%2Fbaz")
      .reply(200, { contentID: "https://github.com/deconst/fake" });

    var content = nock("http://content")
      .get("/content/https%3A%2F%2Fgithub.com%2Fdeconst%2Ffake")
      .reply(409);

    var layout = nock("http://layout")
      .get("/error/https%3A%2F%2Fdeconst.horse%2Ffoo%2Fbar%2Fbaz/409")
      .reply(404);

    request(server.create())
      .get("/foo/bar/baz/")
      .expect(409, done);
  });

  it("allows templates to use handlebars helpers", function (done) {
    var mapping = nock("http://mapping")
      .get("/at/https%3A%2F%2Fdeconst.horse%2Ffoo%2Fbar%2Fbaz")
      .reply(200, { contentID: "https://github.com/deconst/fake" });

    var content = nock("http://content")
      .get("/content/https%3A%2F%2Fgithub.com%2Fdeconst%2Ffake")
      .reply(200, {
        assets: [],
        envelope: {
          layout_key: "default",
          body: "success",
          publish_date: "Fri, 15 May 2015 18:32:45 GMT"
        },
      });

    var layout = nock("http://layout")
      .get("/https%3A%2F%2Fdeconst.horse%2Ffoo%2Fbar%2Fbaz/default")
      .reply(200, "Body [{{{ envelope.body }}}] Date [{{formatDate envelope.publish_date 'YYYY-MM-DD' }}]");

    request(server.create())
      .get("/foo/bar/baz/")
      .expect(200)
      .expect("Content-Type", /html/)
      .expect("Body [success] Date [2015-05-15]", done);
  });

  it("prepends the mount point prefix to absolute next and previous urls", function (done) {
    var mapping = nock("http://mapping")
      .get("/at/https%3A%2F%2Fdeconst.horse%2Ffoo%2Fbar%2Fbaz")
      .reply(200, { prefix: "/foo/", contentID: "https://github.com/deconst/fake" });

    var content = nock("http://content")
      .get("/content/https%3A%2F%2Fgithub.com%2Fdeconst%2Ffake")
      .reply(200, {
        assets: [],
        envelope: {
          layout_key: "default",
          body: "the page content",
          next: { title: "the next one", url: "/next" },
          previous: { title: "the last one", url: "/previous" }
        }
      });

    var layout = nock("http://layout")
      .get("/https%3A%2F%2Fdeconst.horse%2Ffoo%2Fbar%2Fbaz/default")
      .reply(200, "Next [{{ envelope.next.url }}] Previous [{{ envelope.previous.url }}]");

    request(server.create())
      .get("/foo/bar/baz/")
      .expect(200)
      .expect("Content-Type", /html/)
      .expect("Next [/foo/next] Previous [/foo/previous]", done);
  });

  it("leaves relative next and previous urls alone", function (done) {
    var mapping = nock("http://mapping")
      .get("/at/https%3A%2F%2Fdeconst.horse%2Ffoo%2Fbar%2Fbaz")
      .reply(200, { prefix: "/foo/", contentID: "https://github.com/deconst/fake" });

    var content = nock("http://content")
      .get("/content/https%3A%2F%2Fgithub.com%2Fdeconst%2Ffake")
      .reply(200, {
        assets: [],
        envelope: {
          layout_key: "default",
          body: "the page content",
          next: { title: "the next one", url: "../next/" },
          previous: { title: "the last one", url: "../previous/" }
        }
      });

    var layout = nock("http://layout")
      .get("/https%3A%2F%2Fdeconst.horse%2Ffoo%2Fbar%2Fbaz/default")
      .reply(200, "Next [{{ envelope.next.url }}] Previous [{{ envelope.previous.url }}]");

    request(server.create())
      .get("/foo/bar/baz/")
      .expect(200)
      .expect("Content-Type", /html/)
      .expect("Next [../next/] Previous [../previous/]", done);
  });

});
