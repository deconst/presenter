// Crash the presenter process at will with an uncaught exception.
//
// This is useful for debugging the resilience of the system, collection of stacktraces, and so
// forth. It should only be installed in non-production environments.

module.exports = function (req, res) {
    throw new Error("AHHHHHHHHHHHH MOTHERLAND");
};
