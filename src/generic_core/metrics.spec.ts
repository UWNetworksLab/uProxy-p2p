/// <reference path='../../../third_party/typings/index.d.ts' />

import freedomMocker = require('../lib/freedom/mocks/mock-freedom-in-module-env');

import freedom_mocks = require('../mocks/freedom-mocks');
declare var freedom: freedom.FreedomInModuleEnv;
freedom = freedomMocker.makeMockFreedomInModuleEnv({
  'metrics': () => { return new freedom_mocks.MockMetrics(); },
});

import metrics_module = require('./metrics');
import mock_storage = require('../mocks/mock-storage');
var MockStorage = mock_storage.MockStorage;

var networkInfo = {
  natType: 'SymmetricNAT',
  pmpSupport: true,
  pcpSupport: true,
  upnpSupport: false
};

var getNetworkInfoObj = () => {
  return new Promise((F, R) => {
    F(networkInfo);
  })
};

var add = function(a:number,b:number) :number {
  return a+b;
}

var newBuffer = function(a:number) :metrics_module.WeekBuffer<number> {
  var buf = new metrics_module.WeekBuffer<number>();
  buf.update(a, add);
  return buf;
}

var storageValues = {metrics: {
  version: 2,
  successes: newBuffer(1),
  attempts: newBuffer(2),
  stops: newBuffer(3),
  on_gmail: {},
  on_facebook: {},
  on_github: {},
  on_quiver: {},
  on_wechat: {},
  on_cloud: {}
}};

describe('metrics_module.Metrics', () => {
  it('Loads data from storage', (done) => {
    var storage = new MockStorage(storageValues);
    var metrics = new metrics_module.Metrics(storage);
    metrics.onceLoaded_.then(() => {
      expect(metrics.data_.successes.reduce(0,add)).toEqual(1);
      expect(metrics.data_.attempts.reduce(0,add)).toEqual(2);
      done();
    });
  });

  it('Sets values to 0 if no data is in storage', (done) => {
    var storage = new MockStorage({});
    var metrics = new metrics_module.Metrics(storage);
    metrics.onceLoaded_.then(() => {
      expect(metrics.data_.successes.reduce(0,add)).toEqual(0);
      expect(metrics.data_.attempts.reduce(0,add)).toEqual(0);
      done();
    });
  });

  it('Increment adds to the values in storage and saves', (done) => {
    var storage = new MockStorage(storageValues);
    spyOn(storage, 'save').and.callThrough();
    var metrics = new metrics_module.Metrics(storage);
    metrics.onceLoaded_.then(() => {
      expect(metrics.data_.successes.reduce(0,add)).toEqual(1);
      expect(metrics.data_.attempts.reduce(0,add)).toEqual(2);
      expect(storage.save).toHaveBeenCalled();
      done();
    });
    metrics.increment('success');
    // Two attempts: one sucessful, one failure.
    metrics.increment('attempt');
    metrics.increment('attempt');
  });

  it('getReport reports obfuscated metric values', (done) => {
    var storage = new MockStorage(storageValues);
    var metrics = new metrics_module.Metrics(storage);
    metrics.getReport(networkInfo).then((payload :any) => {
      expect(payload['success-v3']).toBeDefined();
      expect(payload['success-v3']).not.toEqual(1);
      expect(payload['fail-rate-v1']).toBeDefined();
      expect(payload['fail-rate-v1']).not.toEqual(2);
      expect(payload['stop-v1']).toBeDefined();
      expect(payload['stop-v1']).not.toEqual(3);
      expect(payload['nat-type-v3']).toBeDefined();
      expect(payload['nat-type-v3']).not.toEqual('SymmetricNAT');
      expect(payload['pmp-v3']).toBeDefined();
      expect(payload['pmp-v3']).not.toEqual(true);
      expect(payload['pcp-v3']).toBeDefined();
      expect(payload['pcp-v3']).not.toEqual(true);
      expect(payload['upnp-v3']).toBeDefined();
      expect(payload['upnp-v3']).not.toEqual(false);
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
    spyOn(mockedMetrics, 'getReport').and.returnValue(
        Promise.resolve({success: 'obfuscated', failure: 'obfuscated'}));

    var storage = new MockStorage(
        {'metrics-report-timestamp': {nextSendTimestamp: Date.now() - 1000}});
    var onReportCallback = jasmine.createSpy('onReportCallback');
    var dailyMetricsReport = new metrics_module.DailyMetricsReporter(
        mockedMetrics, storage, getNetworkInfoObj, onReportCallback);
    dailyMetricsReport.onceLoaded_.then(() => {
      expect(mockedMetrics.getReport).toHaveBeenCalled();
      done();
    });
    jasmine.clock().tick(1);  // Needed to make onceLoaded_ fulfill
  });

  it('Invokes on report callback at stored time if in the future', (done) => {
    spyOn(mockedMetrics, 'getReport').and.callFake(() => { done(); });

    var MS_INTO_FUTURE = 10;
    var timestamp = Date.now() + MS_INTO_FUTURE;
    var storage = new MockStorage(
        {'metrics-report-timestamp': {nextSendTimestamp: timestamp}});
    var onReportCallback = jasmine.createSpy('onReportCallback');
    var dailyMetricsReport = new metrics_module.DailyMetricsReporter(
        mockedMetrics, storage, getNetworkInfoObj, onReportCallback);
    dailyMetricsReport.onceLoaded_.then(() => {
      expect(mockedMetrics.getReport).not.toHaveBeenCalled();
      jasmine.clock().tick(MS_INTO_FUTURE);
    });
    jasmine.clock().tick(1);  // Needed to make onceLoaded_ fulfill
  });

  it('Emits report within MAX_TIMEOUT if no data in storage', (done) => {
    spyOn(mockedMetrics, 'getReport').and.callFake(() => { done(); });

    var onReportCallback = jasmine.createSpy('onReportCallback');
    var dailyMetricsReport = new metrics_module.DailyMetricsReporter(
        mockedMetrics, emptyStorage, getNetworkInfoObj, onReportCallback);
    expect(mockedMetrics.getReport).not.toHaveBeenCalled();
    dailyMetricsReport.onceLoaded_.then(() => {
      expect(mockedMetrics.getReport).not.toHaveBeenCalled();
      jasmine.clock().tick(metrics_module.DailyMetricsReporter.MAX_TIMEOUT);
    });
    jasmine.clock().tick(1);  // Needed to make onceLoaded_ fulfill
  });
});
