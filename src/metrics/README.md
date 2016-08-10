## Directories

* `model/`: The core business logic of the metrics system.
* `adaptors/`: Implementation of model concepts that interfaces with external systems.
* `metrics_server/`: The code for the metrics server application.
* `tools/`: Applications for development and maintenance of the system.

## Using a local Cloud Datastore

Install `gcloud` tool: https://cloud.google.com/sdk/docs/quickstarts

Make sure you have gcloud beta version 2016.01.12 or more recent:

    gcloud --version

Start a local datastore on port 8080:

    npm run datastore-start

Load the sample events from `metrics/sample_events.csv`:

    npm run build && npm run datastore-load

Generate metrics:

  npm run build && npm run datastore-report

This will geenrate two files:

* `out/range_metrics`: unique users and activations per date range for each date and country.
* `out/last_use_metrics.csv`: date and country last use histogram

## Deployment

To deploy the metrics server:

    npm run record-use-build && npm run record-use-deploy

To query the service:

    curl --retry 0 -i -X POST 'https://us-central1-uproxy-metrics.cloudfunctions.net/recordUse?date=2016-02-10&country=AU&previous_date=2016-02-09&previous_country=CN'