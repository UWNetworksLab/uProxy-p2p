"use strict";
const gcloud = require('gcloud');
const fs = require('fs');
const mr = require('../model/metrics_report');
const sd = require('../model/simple_date');
const datastore_use_events_repository_1 = require('../adaptors/datastore_use_events_repository');
class CsvMetricsReport {
    constructor(range_metrics_filename, last_use_filename) {
        this._range_metrics = fs.createWriteStream(range_metrics_filename);
        this._last_use = fs.createWriteStream(last_use_filename);
    }
    addRangeMetric(date, country_matcher, range, metrics) {
        let range_str = `${range}d`;
        if (range % 7 == 0) {
            range_str = `${range / 7}w`;
        }
        this._range_metrics.write(`${date},${country_matcher},${range_str},${metrics.unique_clients},${metrics.new_activations},${metrics.re_activations}\n`);
    }
    addLastUse(date, country_matcher, value) {
        this._last_use.write(`${date},${country_matcher},${value}\n`);
    }
    end() {
        this._range_metrics.end();
        this._last_use.end();
    }
}
let events_repo = new datastore_use_events_repository_1.default(gcloud().datastore({
    projectId: 'uproxy-metrics',
    namespace: 'test'
}));
events_repo.countEntries().then((count) => {
    console.log('Datastore has %d entries', count);
});
let end_date = sd.datefromString('2016-08-06');
let start_date = end_date.minusDays(180);
let report = new CsvMetricsReport('./out/range_metrics.csv', './out/last_use_metrics.csv');
mr.generateReport(events_repo, start_date, end_date, report).catch((error) => {
    console.error('Failed to generate report: %s', error);
});
