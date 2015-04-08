# presenter

A Deconst component that assembles and returns completed HTML documents to end users.

[![Build Status](https://travis-ci.org/deconst/presenter.svg?branch=master)](https://travis-ci.org/deconst/presenter)
[![Docker Repository on Quay.io](https://quay.io/repository/deconst/presenter/status "Docker Repository on Quay.io")](https://quay.io/repository/deconst/presenter)

## Installation

To develop locally, you'll need to install:

 * [Docker](https://docs.docker.com/installation/#installation) to build and launch the container.
 * [docker-compose](https://docs.docker.com/compose/install/) to manage the container's configuration.

Then, you can build and run the service with:

```bash
# See below for service configuration.
export RACKSPACE_USERNAME=...
export RACKSPACE_APIKEY=...

docker-compose build && docker-compose up -d
```

## Configuration

Set the following environment variables:

 * `MAPPING_SERVICE_URL`: **Required**. URL of the mapping service.

 * `CONTENT_SERVICE_URL`: **Required**. URL of the content service.

 * `LAYOUT_SERVICE_URL`: **Required**. URL of the layout service.

 * `PRESENTED_URL_DOMAIN`: Use a constant instead of the `Host:` value as the domain of the presented URL. Useful for development in environments without DNS.
