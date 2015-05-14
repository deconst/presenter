// Unit tests for the configuration system.

var
  expect = require("chai").expect,
  config = require("../src/config");

describe("config", function () {
  it("reads configuration values from the environment", function () {
    config.configure({
      MAPPING_SERVICE_URL: "https://mapping",
      CONTENT_SERVICE_URL: "https://content",
      LAYOUT_SERVICE_URL: "https://layout",
      PRESENTED_URL_PROTO: "http",
      PRESENTED_URL_DOMAIN: "deconst.horse",
      PRESENTER_LOG_LEVEL: "debug"
    });

    expect(config.mapping_service_url()).to.equal("https://mapping");
    expect(config.content_service_url()).to.equal("https://content");
    expect(config.layout_service_url()).to.equal("https://layout");
    expect(config.presented_url_proto()).to.equal("http");
    expect(config.presented_url_domain()).to.equal("deconst.horse");
    expect(config.log_level()).to.equal("debug");
  });

  it("requires service URLs", function () {
      expect(function () {
        config.configure({});
      }).to.throw(Error, /Inadequate configuration/);
  });

  it("defaults the log level", function () {
    config.configure({
      MAPPING_SERVICE_URL: "https://mapping",
      CONTENT_SERVICE_URL: "https://content",
      LAYOUT_SERVICE_URL: "https://layout"
    });

    expect(config.log_level()).to.equal("info");
  });

  it("normalizes service URLs", function () {
    config.configure({
      MAPPING_SERVICE_URL: "https://mapping/",
      CONTENT_SERVICE_URL: "https://content/",
      LAYOUT_SERVICE_URL: "https://layout/"
    });

    expect(config.mapping_service_url()).to.equal("https://mapping");
    expect(config.content_service_url()).to.equal("https://content");
    expect(config.layout_service_url()).to.equal("https://layout");
  });
});
