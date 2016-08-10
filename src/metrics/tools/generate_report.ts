/// <reference path="../typings/globals/es6-collections/index.d.ts" />

import gcloud = require('gcloud');
import fs = require('fs');

import mr = require('../model/metrics_report');
import sd = require('../model/simple_date');
import umr = require('../model/use_events_repository');
import DatastoreUseEventsRepository from '../adaptors/datastore_use_events_repository';

class CsvMetricsReport implements mr.MetricsReport {
  private _range_metrics: fs.WriteStream;
  private _last_use: fs.WriteStream;

  public constructor(range_metrics_filename: string, last_use_filename: string) {
    this._range_metrics = fs.createWriteStream(range_metrics_filename);
    this._last_use = fs.createWriteStream(last_use_filename);
  }

  public addRangeMetric(date: sd.SimpleDate, country_matcher: mr.CountryMatcher, range: number, metrics: mr.DateRangeMetrics): void {
    let range_str = `${range}d`;
    if (range % 7 == 0) {
      range_str = `${range / 7}w`;
    }
    this._range_metrics.write(
      `${date},${country_matcher},${range_str},${metrics.unique_clients},${metrics.new_activations},${metrics.re_activations}\n`
    );
  }

  public addLastUse(date: sd.SimpleDate, country_matcher: mr.CountryMatcher, value: number): void {
    this._last_use.write(`${date},${country_matcher},${value}\n`);
  }

  public end() {
    this._range_metrics.end();
    this._last_use.end();
  }
}

let events_repo = new DatastoreUseEventsRepository(gcloud().datastore({
  projectId: 'uproxy-metrics',
  namespace: 'test'
}));

events_repo.countEntries().then((count) => {
  console.log('Datastore has %d entries', count);
})

let end_date = sd.datefromString('2016-08-06');
let start_date = end_date.minusDays(180);
let report = new CsvMetricsReport('./out/range_metrics.csv', './out/last_use_metrics.csv');

mr.generateReport(events_repo, start_date, end_date, report).catch((error) => {
  console.error('Failed to generate report: %s', error);
});
