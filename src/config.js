// Handle application configuration.

var configuration = {
  mapping_service_url: {
    env: "MAPPING_SERVICE_URL",
    description: "URL of the mapping service",
    normalize: normalize_url,
    required: true
  },
  content_service_url: {
    env: "CONTENT_SERVICE_URL",
    description: "URL of the content service",
    normalize: normalize_url,
    required: true
  },
  presented_url_domain: {
    env: "PRESENTED_URL_DOMAIN",
    description: "Override the domain of presented URLs",
    required: false
  }
};

// Utility function to ensure that no URLs end with a trailing slash.
function normalize_url(url) {
  if (url.slice(-1) === '/') {
    return url.slice(0, -1);
  }
  return url;
}

// Read configuration values from the environment. Report an error and raise an exception if any
// required values are missing.
exports.configure = function (env) {
  var missing = [];

  for (var name in configuration) {
    var setting = configuration[name];
    var value = env[setting.env];

    if (value && setting.normalize) {
      value = setting.normalize(value);
    }

    setting.value = value;

    // Missing or blank values from the environment are considered "unset."
    if (! value && setting.required) {
      missing.push(setting);
    }
  }

  if (missing.length !== 0) {
    console.error("Required configuration values are missing!");
    console.error("Please set the following environment variables:");
    console.error("");
    missing.forEach(function (setting) {
      console.error("  " + setting.env + ": " + setting.description);
    });
    console.error("");

    throw new Error("Inadequate configuration");
  }
};

// Export "getter" functions with the same name as each configuration option.
for (var name in configuration) {
  (function (each) {
    exports[each] = function () {
      return configuration[each].value;
    }
  })(name);
}
