# DEPRECATED. Use https://gitlab.com/deconst-next/presenter

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

# Deconst Dev Env in Kubernetes with Minikube

These instructions will create the resources necessary to run the deconst presenter service in a dev env in Kubernetes with Minikube.

1. If necessary, deploy the [content service](https://github.com/deconst/content-service#deconst-dev-env-in-kubernetes-with-minikube)

1. Open a new shell

1. Customize your environment settings

    ```bash
    cp env.example env
    ${EDITOR} env
    ```

    Edit the following environment variables.

    * `DOCKER_IMAGE=kube-registry.kube-system.svc.cluster.local:31000/presenter:dev`
      * If you want to use the production image instead, keep the default value and skip the next step
    * `CONTENT_SERVICE_URL=http://content.deconst.svc.cluster.local:9000/`
    * `CONTROL_REPO_PATH=/tmp/control-repo`
    * `CONTROL_REPO_URL=https://github.com/deconst/deconst-docs-control.git`
    * `PRESENTED_URL_DOMAIN=deconst.horse`


    ```bash
    source ./env
    ```

1. Build a development Docker image

    ```bash
    eval $(minikube docker-env)
    docker build --tag kube-registry.kube-system.svc.cluster.local:31000/presenter:dev .
    docker push kube-registry.kube-system.svc.cluster.local:31000/presenter:dev
    ```

1. Create resources

    ```bash
    script/template kubernetes/deployment.yaml | kubectl apply -f -
    ```

1. Watch and wait for resources

    ```bash
    watch kubectl get pods --namespace deconst
    ```

1. Test that the presenter and staging presenter services are nominally working

    ```bash
    curl $(minikube service --url --namespace deconst presenter)/version/
    curl $(minikube service --url --namespace deconst staging-presenter)/version/
    ```

1. Deploy the [deconst docs](https://github.com/deconst/deconst-docs#deconst-dev-env-in-kubernetes-with-minikube)

1. Delete resources

    ```bash
    kubectl delete deploy/presenter svc/presenter --namespace deconst
    kubectl delete deploy/staging-presenter svc/staging-presenter  --namespace deconst
    ```
