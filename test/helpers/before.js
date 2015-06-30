// Common setup functions for unit tests.

exports.settings = {
    CONTROL_REPO_PATH: './test/test-control',
    MAPPING_SERVICE_URL: 'http://mapping',
    CONTENT_SERVICE_URL: 'http://content',
    LAYOUT_SERVICE_URL: 'http://layout',
    PRESENTED_URL_PROTO: 'https',
    PRESENTED_URL_DOMAIN: 'deconst.horse',
    PRESENTER_LOG_LEVEL: process.env.PRESENTER_LOG_LEVEL
};
