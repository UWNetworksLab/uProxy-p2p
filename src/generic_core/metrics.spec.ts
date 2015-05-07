/// <reference path='../../../third_party/typings/jasmine/jasmine.d.ts' />

import metrics_module = require('./metrics');
import storage_interface = require('../interfaces/storage');

export class MockStorage implements storage_interface.Storage {
  constructor(private data_ ?:any) {
  }
  public reset = () : Promise<void> => {
    return Promise.resolve<void>();
  }
  public load<T>(key :string) : Promise<T> {
    if (this.data_[key]) {
      return Promise.resolve(this.data_[key]);
    } else {
      return Promise.reject('non-existing key');
    }
  }
  public save<T>(key :string, val :T) : Promise<T> {
    this.data_[key] = val;
    return Promise.resolve();
  }
  public keys = () : Promise<string[]> => {
    return Promise.resolve(Object.keys(this.data_));
  }
}  // class MockStorage

describe('metrics_module.Metrics', () => {
  it('Loads data from storage', (done) => {
    var storage = new MockStorage({metrics: {success: 1, failure: 2}});
    var metrics = new metrics_module.Metrics(storage);
    metrics.onceLoaded_.then(() => {
      expect(metrics.data_.success).toEqual(1);
      expect(metrics.data_.failure).toEqual(2);
      done();
    });
  });

  it('Sets values to 0 if no data is in storage', (done) => {
    var storage = new MockStorage({});
    var metrics = new metrics_module.Metrics(storage);
    metrics.onceLoaded_.then(() => {
      expect(metrics.data_.success).toEqual(0);
      expect(metrics.data_.failure).toEqual(0);
      done();
    });
  });

  it('Increment adds to the values in storage and saves', (done) => {
    var storage = new MockStorage({metrics: {success: 1, failure: 2}});
    spyOn(storage, 'save').and.callThrough();
    var metrics = new metrics_module.Metrics(storage);
    metrics.onceLoaded_.then(() => {
      expect(metrics.data_.success).toEqual(2);
      expect(metrics.data_.failure).toEqual(3);
      expect(storage.save).toHaveBeenCalled();
      done();
    });
    metrics.increment('success');
    metrics.increment('failure');
  });

  it('getReport reports obfuscated success and failure values', (done) => {
    var storage = new MockStorage({metrics: {success: 1, failure: 2}});
    var metrics = new metrics_module.Metrics(storage);
    metrics.getReport().then((payload :Object) => {
      expect(metrics.data_.success).toBeDefined();
      expect(metrics.data_.success).not.toEqual(3);
      expect(metrics.data_.failure).toBeDefined();
      expect(metrics.data_.failure).not.toEqual(3);
      done();
    });
  });
});

describe('metrics_module.DailyMetricsReporter', () => {
  var emptyStorage = new MockStorage({});
  var mockedMetrics :metrics_module.Metrics;

  beforeEach(() => {
    jasmine.clock().install();
    mockedMetrics = new metrics_module.Metrics(emptyStorage);
    spyOn(mockedMetrics, 'getReport').and.returnValue(
        Promise.resolve({success: 'obfuscated', failure: 'obfuscated'}));
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  // TODO: these tests all check that mockedMetrics.getReport is called.
  // It would be better if they instead checked that the onReportCallback was
  // called.  However checking that currently fails.  The problem is that
  // after incrementing the clock, dailyMetricsReport calls report_ using a
  // a setTimeout which completes asynchronously (after metrics.getReport).
  // We don't have a way to detect that the call to report_ has finished if
  // it is invoked via setTimeout.

  it('Invokes on report callback immediately if stored time has passed', (done) => {
    var storage = new MockStorage(
        {'metrics-report-timestamp': {nextSendTimestamp: Date.now() - 1000}});
    var onReportCallback = jasmine.createSpy('onReportCallback');
    var dailyMetricsReport = new metrics_module.DailyMetricsReporter(
        mockedMetrics, storage, onReportCallback);
    dailyMetricsReport.onceLoaded_.then(() => {
      expect(mockedMetrics.getReport).toHaveBeenCalled();
      done();
    });
    jasmine.clock().tick(1);  // Needed to make onceLoaded_ fulfill
  });

  it('Invokes on report callback at stored time if in the future', (done) => {
    var storage = new MockStorage(
        {'metrics-report-timestamp': {nextSendTimestamp: Date.now() + 10}});
    var onReportCallback = jasmine.createSpy('onReportCallback');
    var dailyMetricsReport = new metrics_module.DailyMetricsReporter(
        mockedMetrics, storage, onReportCallback);
    dailyMetricsReport.onceLoaded_.then(() => {
      expect(mockedMetrics.getReport).not.toHaveBeenCalled();
      jasmine.clock().tick(10);
      expect(mockedMetrics.getReport).toHaveBeenCalled();
      done();
    });
    jasmine.clock().tick(1);  // Needed to make onceLoaded_ fulfill
  });

  it('Emits report within MAX_TIMEOUT if no data in storage', (done) => {
    var onReportCallback = jasmine.createSpy('onReportCallback');
    var dailyMetricsReport = new metrics_module.DailyMetricsReporter(
        mockedMetrics, emptyStorage, onReportCallback);
    expect(mockedMetrics.getReport).not.toHaveBeenCalled();
    dailyMetricsReport.onceLoaded_.then(() => {
      expect(mockedMetrics.getReport).not.toHaveBeenCalled();
      jasmine.clock().tick(metrics_module.DailyMetricsReporter.MAX_TIMEOUT);
      expect(mockedMetrics.getReport).toHaveBeenCalled();
      done();
    });
    jasmine.clock().tick(1);  // Needed to make onceLoaded_ fulfill
  });
});
