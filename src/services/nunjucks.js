var nunjucks = require('nunjucks');
var nunjucksDate = require('nunjucks-date');
var services = {
    path: require('./path')
};

var env = new nunjucks.Environment(
    new nunjucks.FileSystemLoader(services.path.getTemplatesPath()),
    {

    }
);

env.addFilter('date', nunjucksDate);

env.addFilter('json', function (data) {
    var string = JSON.stringify(data, null, 4);
    string = string.replace(/</g,'&lt;').replace(/>/g, '&gt;');

    return '<pre><code>' + string + '</code></pre>';
});


module.exports = env;
