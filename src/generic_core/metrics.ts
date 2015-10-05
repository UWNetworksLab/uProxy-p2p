/// <reference path='../../../third_party/freedomjs-anonymized-metrics/freedomjs-anonymized-metrics.d.ts' />

import crypto = require('../../../third_party/uproxy-lib/crypto/random');
import logging = require('../../../third_party/uproxy-lib/logging/logging');
import storage = require('../interfaces/storage');
import uproxy_core_api = require('../interfaces/uproxy_core_api');

var log :logging.Log = new logging.Log('metrics');

export interface MetricsData {
  version :number;
  success :number;  // Number of successes for getting access only.
  failure :number;  // Number of failures for getting access only.
};

export class Metrics {
  public onceLoaded_ :Promise<void>;  // Only public for tests
  private metricsProvider_ :freedom_AnonymizedMetrics;
  // data_ should be private except for tests.
  public data_ :MetricsData = {version: 1, success: 0, failure: 0};

  constructor(private storage_ :storage.Storage) {
    var counterMetric = {
      type: 'logarithmic', base: 2, num_bloombits: 8, num_hashes: 2,
      num_cohorts: 64, prob_p: 0.5, prob_q: 0.75, prob_f: 0.5,
      flag_oneprr: true
    };
    var natMetric = {
      type: 'string', num_bloombits: 8, num_hashes: 2,
      num_cohorts: 64, prob_p: 0.5, prob_q: 0.75, prob_f: 0.5,
      flag_oneprr: true
    };
    this.metricsProvider_ = freedom['metrics']({
      name: 'uProxyMetrics',
      definition: {'success-v1': counterMetric, 'failure-v1': counterMetric,
                   'nat-type-v2': natMetric, 'pmp-v2': natMetric,
                   'pcp-v2': natMetric, 'upnp-v2': natMetric}
    });

    this.onceLoaded_ = this.storage_.load('metrics').then(
        (storedData :MetricsData) => {
      log.info('Loaded metrics from storage', storedData);
      // Add stored metrics to current data_, in case increment has been
      // called before storage loading is complete.
      this.data_.success += storedData.success;
      this.data_.failure += storedData.failure;
    }).catch((e :Error) => {
      // Not an error if no metrics are found storage, just use the default
      // values for success, failure, etc.
      log.info('No metrics found in storage');
    });
  }

  public increment = (name :string) => {
    if (name == 'success') {
      this.data_.success++;
      this.save_();
    } else if (name == 'failure') {
      this.data_.failure++;
      this.save_();
    } else {
      log.error('Unknown metric ' + name);
    }
  }

  public getReport = (natInfo:uproxy_core_api.NetworkInfo) :Promise<Object> => {
    if (natInfo.errorMsg) {
      return Promise.reject(new Error('getNetworkInfo() failed.'));
    }

    // Don't catch any Promise rejections here so that they can be handled
    // by the caller instead.
    return this.onceLoaded_.then(() => {
      var successReport =
        this.metricsProvider_.report('success-v1', this.data_.success);
      var failureReport =
        this.metricsProvider_.report('failure-v1', this.data_.failure);
      var natTypeReport =
        this.metricsProvider_.report('nat-type-v2', natInfo.natType);
      var pmpReport =
        this.metricsProvider_.report('pmp-v2', natInfo.pmpSupport.toString());
      var pcpReport =
        this.metricsProvider_.report('pcp-v2', natInfo.pcpSupport.toString());
      var upnpReport =
        this.metricsProvider_.report('upnp-v2', natInfo.upnpSupport.toString());

      return Promise.all([successReport, failureReport, natTypeReport,
                          pmpReport, pcpReport, upnpReport]).then(() => {
          console.error('calling retrieve');
        return this.metricsProvider_.retrieve();
      });
    });
  }

  public reset = () => {
    this.data_.success = 0;
    this.data_.failure = 0;
    this.save_();
  }

  private save_ = () => {
    this.storage_.save('metrics', this.data_).catch((e :Error) => {
      log.error('Could not save metrics to storage', e);
    });
  }
}


export interface DailyMetricsReporterData {
  nextSendTimestamp :number;  // timestamp in milliseconds
};


export class DailyMetricsReporter {
  // 5 days in milliseconds.
  // public static MAX_TIMEOUT = 5 * 24 * 60 * 60 * 1000;  // TODO: use this
  public static MAX_TIMEOUT = 5000;

  public onceLoaded_ :Promise<void>;  // Only public for tests

  private data_ :DailyMetricsReporterData;

  constructor(private metrics_ :Metrics, private storage_ :storage.Storage,
              private getNetworkInfoObj_ :Function,
              private onReportCallback_ :Function) {
    this.onceLoaded_ = this.storage_.load('metrics-report-timestamp').then(
        (data :DailyMetricsReporterData) => {
      log.info('Loaded metrics-report-timestamp from storage', data);
      this.data_ = data;
    }).catch((e :Error) => {
      this.data_ = {
        nextSendTimestamp: DailyMetricsReporter.getNextSendTimestamp_()
      };
      this.save_();
    }).then(() => {
      // Once this.data_.nextSendTimestamp is initialized, setup a report
      // to be generated at that time.
      log.info('sending metrics report at ' + this.data_.nextSendTimestamp);
      DailyMetricsReporter.runNowOrLater_(
          this.report_.bind(this), this.data_.nextSendTimestamp);
    });
  }

  private report_ = () => {
    // TODO(kennysong): Ideally we want to call getNetworkInfoObj_() as a static
    // method of uproxy_core.uProxyCore, instead of passing the function in
    // as a parameter. This can be done after the circular dependency is fixed.
    // See: https://github.com/uProxy/uproxy/issues/1660
    this.getNetworkInfoObj_().then((natInfo:uproxy_core_api.NetworkInfo) => {
      return this.metrics_.getReport(natInfo);
    }).then((payload:Object) => {
      this.onReportCallback_(payload);
    }).catch((e :Error) => {
      log.error('Error getting report', e);
    }).then(() => {
      // Reset metrics, and set nextSendTimestamp regardless of whether
      // metrics.getReport succeeded or failed.
      this.metrics_.reset();
      this.data_.nextSendTimestamp =
          DailyMetricsReporter.getNextSendTimestamp_();
      DailyMetricsReporter.runNowOrLater_(
          this.report_.bind(this), this.data_.nextSendTimestamp);
      this.save_();
    });
  }

  // Invokes callback at the given time (specified in milliseconds).  If the
  // given time is in the past, invokes the callback immediately.
  private static runNowOrLater_ = (callback :Function,
                                   timestampInMs :number) => {
    var offset_ms = timestampInMs - Date.now();
    if (offset_ms <= 0) {
      callback();
    } else {
      setTimeout(callback, offset_ms);
    }
  }

  private static getNextSendTimestamp_ = () => {
    // Use Poisson distrubtion to calculate offset_ms in approx 24 hours.
    // TODO: use crypto.randomUint32 once it's available everywhere
    // var randomFloat = crypto.randomUint32() / Math.pow(2, 32);
    var randomFloat = Math.random();
    var MS_PER_DAY = 24 * 60 * 60 * 1000;
    var offset_ms = -Math.floor(Math.log(randomFloat) / (1 / MS_PER_DAY));
    offset_ms = Math.min(offset_ms, DailyMetricsReporter.MAX_TIMEOUT);
    return Date.now() + offset_ms;
  }

  private save_ = () => {
    this.storage_.save('metrics-report-timestamp', this.data_)
        .catch((e :Error) => {
      log.error('Could not save metrics-report-timestamp to storage', e);
    });
  }
};
