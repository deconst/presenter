# presenter

A Deconst component that assembles and returns completed HTML documents to end users.

[![Build Status](https://travis-ci.org/deconst/presenter.svg?branch=master)](https://travis-ci.org/deconst/presenter)
[![Docker Repository on Quay.io](https://quay.io/repository/deconst/presenter/status "Docker Repository on Quay.io")](https://quay.io/repository/deconst/presenter)

## Installation

To develop locally, you'll need to install:

 * [Docker](https://docs.docker.com/installation/#installation) to build and launch the container.
 * [docker-compose](https://docs.docker.com/compose/install/) to manage the container's configuration.

Then, you should copy `env.example` and save it as `env`. Open the file in your favorite text editor, and follow the included instructions to add values to each environment variable. They're all required.

Once you've filled in all the environment variables, use `source` to add them to your current Bash environment:

```bash
source ./env
```
And _now_ you're ready to actually run the app! Just build the images and start the stack:

```bash
docker-compose build && docker-compose up -d
```

The app will run in the background until you run `docker-compose stop`. You can also run `docker-compose logs` to see what the app is doing.

The presenter portion of the app runs under [nodemon](http://nodemon.io/), so the presenter will be restarted automatically every time you save a file that's part of its source code. Certain changes (like adding a dependency to `package.json`) will require you to rebuild and restart the container.
