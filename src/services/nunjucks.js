var fs = require('fs');
var path = require('path');
var nunjucks = require('nunjucks');
var nunjucksDate = require('nunjucks-date');
var nunjucksFallback = require('./nunjucks-fallback');
var services = {
    path: require('./path')
};

var envs = {};

function createEnvironment(context) {
    var env = new nunjucks.Environment(
        new nunjucks.FileSystemLoader([
            services.path.getTemplatesPath(context),
            services.path.getDefaultTemplatesPath()
        ], { watch: true })
    );

    env.addFilter('date', nunjucksDate);
    env.addFilter('fallback', nunjucksFallback);

    env.addFilter('json', function (data) {
        var string = JSON.stringify(data, null, 4);
        string = string.replace(/</g,'&lt;').replace(/>/g, '&gt;');

        return '<pre><code>' + string + '</code></pre>';
    });

    addPlugins(env, context);

    return env;
}

var addPlugins = function (env, context) {
    var pluginPath = services.path.getPluginsPath(context);
    fs.readdirSync(pluginPath).forEach(function (pluginDir) {
        var plugin = require(path.join(pluginPath, pluginDir));

        if(plugin.templateFilters.length > 0) {
            plugin.templateFilters.forEach(function (filter) {
                env.addFilter.apply(env, filter);
            });
        }

    });
};

var NunjucksService = {
    clearEnvironments: function () {
        envs = {};
    },
    getEnvironment: function (context) {
        var host = context.host();

        if (envs[host]) {
            return envs[host];
        }

        var env = createEnvironment(context);
        envs[host] = env;
        return env;
    }
};

module.exports = NunjucksService;
