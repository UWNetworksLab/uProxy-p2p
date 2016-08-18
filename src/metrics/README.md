# uProxy Metrics

## Set up development environment

All development is done from the `src/metrics` root:

    cd src/metrics

Install the external dependencies:

    npm install

You can run unit tests with:

    npm test

## Directories

Library directories:

* `model/`: The core business logic of the metrics system.
* `adaptors/`: Implementation of model concepts that interfaces with external systems.

Application directories:

* `metrics_server/`: The code for the metrics server application.
* `tools/`: Applications for development and maintenance of the system.

There are a few restrictions on dependencies between the modules:

* `model` cannot depend on anything other than the `model` itself and basic external libraries.
* `adaptors` can depend on `model` and external libraries, but not on applications.
* Application modules can depend on `model` and `adaptors` but not on other applications.

## Local Development

Install `gcloud` tool: https://cloud.google.com/sdk/docs/quickstarts

Make sure you have gcloud beta version 2016.01.12 or more recent:

    gcloud --version

Start a local datastore on port 8080:

    npm build-tools && npm run datastore-start

Load the sample events from `metrics/sample_events.csv`:

    npm build-tools && npm run datastore-load

Generate metrics:

    npm run build-tools && npm run datastore-report

This will generate two files:

* `out/range_metrics`: unique users and activations per date range for each date and country.
* `out/last_use_metrics.csv`: date and country last use histogram

Run a local metrics server:

    npm run build-server && npm run start

You can make POST requests with `curl`. Example:

    curl --retry 0 -i -X POST 'localhost:8080/recordUse?date=2016-02-10&country=AU&previous_date=2016-02-09&previous_country=CN'

## Deployment

To deploy a **pre-built** metrics server:

    npm run deploy

To query the service:

    curl --retry 0 -i -X POST -H 'Content-length: 0' 'https://uproxy-metrics.appspot.com/recordUse?date=2016-02-10&country=AU&previous_date=2016-02-09&previous_country=CN'
