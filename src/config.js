// Handle application configuration.

var configuration = {
    control_repo_path: {
        env: "CONTROL_REPO_PATH",
        description: "Filesystem path to the control repo",
        required: true
    },
    control_content_file: {
        env: "CONTROL_CONTENT_FILE",
        description: "basename of the control repo's content config file",
        def: 'content.json',
        required: true
    },
    control_rewrites_file: {
        env: "CONTROL_REWRITES_FILE",
        description: "basename of the control repo's rewrites config file",
        def: 'rewrites.json',
        required: false
    },
    control_routes_file: {
        env: "CONTROL_ROUTES_FILE",
        description: "basename of the control repo's routes config file",
        def: 'routes.json',
        required: true
    },
    content_service_url: {
        env: "CONTENT_SERVICE_URL",
        description: "URL of the content service",
        normalize: normalize_url,
        required: true
    },
    presented_url_proto: {
        env: "PRESENTED_URL_PROTO",
        description: "Override the protocol of presented URLs",
        required: false
    },
    presented_url_domain: {
        env: "PRESENTED_URL_DOMAIN",
        description: "Override the domain of presented URLs",
        required: false
    },
    public_url_proto: {
        env: "PUBLIC_URL_PROTO",
        description: "Override the protocol of outgoing URLs",
        required: false
    },
    public_url_domain: {
        env: "PUBLIC_URL_DOMAIN",
        description: "Override the domain of outgoing URLs",
        required: false
    },
    log_level: {
        env: "PRESENTER_LOG_LEVEL",
        description: "Log level for the presenter.",
        normalize: normalize_lower,
        def: "info",
        required: false
    },
    log_colorize: {
        env: "PRESENTER_LOG_COLOR",
        description: "Set to 'true' to enable colorized log output.",
        normalize: normalize_bool,
        def: "false",
        required: false,
    },
    presenter_diagnostics: {
        env: "PRESENTER_DIAGNOSTICS",
        description: "Enable diagnostic tooling within the presenter.",
        required: false
    }
};

// Normalize a URL by ensuring that it ends with a trailing slash.
function normalize_url(url) {
  if (url.slice(-1) === '/') {
    return url.slice(0, -1);
  }
  return url;
}

// Normalize a string by ensuring that it's lowercase.
function normalize_lower(str) {
  return str.toLowerCase();
}

function normalize_bool(str) {
    var lower = str.toLowerCase();
    if (lower === "true") {
        return true;
    }
    if (lower === "false") {
        return false;
    }

    throw new Error("Invalid boolean setting: '" + str + "'");
}

// Create a getter function for the named setting.
function make_getter(setting_name) {
  return function () {
    return configuration[setting_name].value;
  };
}

// Read configuration values from the environment. Report an error and raise an exception if any
// required values are missing.
exports.configure = function (env) {
  var missing = [];

  for (var name in configuration) {
    var setting = configuration[name];
    var value = env[setting.env];

    if (! value && setting.def) {
      value = setting.def;
    }

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

exports.set = function (options) {
    for(var name in options) {
        configuration[normalize_lower(name)].value = options[name];
    }
};

// Export "getter" functions with the same name as each configuration option.
for (var name in configuration) {
  exports[name] = make_getter(name);
}
