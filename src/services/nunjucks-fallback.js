module.exports = function () {
    for(var key in arguments) {
        if(arguments[key]) {
            return arguments[key];
        }
    }

    return '';
};
