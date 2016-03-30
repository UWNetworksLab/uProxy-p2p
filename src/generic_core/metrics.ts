/// <reference path='../../../third_party/freedomjs-anonymized-metrics/freedomjs-anonymized-metrics.d.ts' />

import _ = require('lodash');
import crypto = require('../../../third_party/uproxy-lib/crypto/random');
import logging = require('../../../third_party/uproxy-lib/logging/logging');
import storage = require('../interfaces/storage');
import uproxy_core_api = require('../interfaces/uproxy_core_api');

var log :logging.Log = new logging.Log('metrics');
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export interface Updater<T> {
  (orig :T, increment :T):T;
};

export class WeekBuffer<T> {
  // timestamps_[k] and values_[k] represent the same bucket (called k).
  timestamps_: number[];
  values_: T[];

  constructor() {
    this.reset();
  }

  public reset() {
    this.timestamps_ = [];
    this.values_ = [];
  }

  // Put 'value' in for today's bucket.  If there's an existing one,
  // call 'updater(old, value)' and save its result in the bucket.
  public update(value:T, updater:Updater<T>): void {
    this.trim();
    var now = Date.now();
    if (this.timestamps_.length == 0) {
      this.timestamps_.push(now);
      this.values_.push(value);
      return;
    }
    if (now - this.timestamps_[this.timestamps_.length-1] > ONE_DAY_MS) {
      if (this.timestamps_.length >= 7) {
        // this can't happen.
        log.error('WeekBuffer buckets corrupt!');
      }
      this.timestamps_.push(now);
      this.values_.push(value);
    } else {
      // we're within the last bucket.
      var idx = this.timestamps_.length-1;
      this.values_[idx] = updater(this.values_[idx], value);
    }
  }

  public merge(other:WeekBuffer<T>, updater:Updater<T>) {
    other.trim();
    this.trim();
    if (other.timestamps_.length == 0) {
      return;
    } else if (this.timestamps_.length == 0) {
      this.timestamps_ = other.timestamps_;
      this.values_ = other.values_;
      return;
    } else {
      log.error('WeekBuffer<T>.merge: actual merging unimplemented.');
    }
  }

  private trim() {
    var threshold = Date.now() - (7 * ONE_DAY_MS);
    while (this.timestamps_.length > 0 && this.timestamps_[0] < threshold) {
      this.timestamps_.shift();
      this.values_.shift();
    }
  }

  public reduce(value:T, updater:Updater<T>): T {
    return _.reduce(this.values_, updater, value);
  }
};

export interface NetMetrics {
  [userid :string] :number;
};


export class MetricsData {
  public version :number;
  public successes :WeekBuffer<number>;  // Number of getter-side successful proxy
                                         // sessions started.
  public attempts :WeekBuffer<number>;  // Total number of attempts for getting access.
  public shutdowns :WeekBuffer<number>;  // Number of times a proxy session lived long
                                         // enough that a getter hit the 'stop
                                         // proxying' button.
  // Social network stats:
  //   Negative (-1) for not logged in
  //   When logged in, the number of friends
  //   We report the max value seen for this session.
  public on_gmail :NetMetrics;
  public on_facebook :NetMetrics;
  public on_github :NetMetrics;
  public on_quiver :NetMetrics;
  public on_wechat :NetMetrics;
  public on_cloud :NetMetrics;
  constructor() {
    this.version = 2;
    this.successes = new WeekBuffer<number>();
    this.attempts = new WeekBuffer<number>();
    this.shutdowns = new WeekBuffer<number>();
    this.on_gmail = {};
    this.on_facebook = {};
    this.on_github = {};
    this.on_quiver = {};
    this.on_wechat = {};
    this.on_cloud = {};
  }
};

function max(a :number, b :number) :number {
  if (a === undefined) {
    return b;
  } else if (b === undefined) {
    return a;
  } else {
    return a > b? a : b;
  }
};

function mergeNet(first:NetMetrics, second :NetMetrics) :NetMetrics {
  var result = first;
  for (var k in second) {
    result[k] = max(result[k], second[k]);
  }
  return result;
};

function calcQuantile(numerator :number, denominator :number) {
  return Math.floor(20 * Math.floor((5.0*numerator) / denominator));
}

function sumMetrics(mets :NetMetrics) :number{
  var total = 0;
  var num = 0;
  for (var k in mets) {
    total += mets[k];
    num++;
  }
  if (num == 0) {
    return -1;
  } else {
    return total;
  }
}

export class Metrics {
  public onceLoaded_ :Promise<void>;  // Only public for tests
  private add_ :Updater<number>;
  private metricsProvider_ :freedom_AnonymizedMetrics;
  // data_ should be private except for tests.
  public data_ :MetricsData;

  constructor(private storage_ :storage.Storage) {
    this.add_ = (a,b) => { return a+b; };

    var counterMetric = {
      type: 'logarithmic', base: 2, num_bloombits: 256, num_hashes: 1,
      num_cohorts: 8, prob_p: 0.25, prob_q: 0.75, prob_f: 0.5,
      flag_oneprr: true
    };
    var stringMetric = {
      type: 'string', num_bloombits: 256, num_hashes: 1,
      num_cohorts: 8, prob_p: 0.25, prob_q: 0.75, prob_f: 0.5,
      flag_oneprr: true
    };
    var natMetric = stringMetric;
    // This will be an integer as string, values: 0, 20, 40, 60, 80, 100.
    var percentageMetric = stringMetric;
    // A positive integer.
    var versionMetric = stringMetric;
    // 'windows', 'mac', 'linux', 'ios'
    var platformMetric = stringMetric;
    // An integer, possibly -1.
    var networkMetric = stringMetric;
    this.metricsProvider_ = freedom['metrics']({
      name: 'uProxyMetrics',
      definition: {'success-v3': counterMetric,
                   'fail-rate-v1': percentageMetric,
                   'chrome-version-v1' :versionMetric,
                   'ff-version-v1' :versionMetric,
                   'platform-v1' :platformMetric,
                   'shutdown-v1' :percentageMetric,
                   'gmail-v1' :networkMetric,
                   'facebook-v1' :networkMetric,
                   'github-v1' :networkMetric,
                   'quiver-v1' :networkMetric,
                   'wechat-v1' :networkMetric,
                   'cloud-v1' :networkMetric,
                   'nat-type-v3': stringMetric,
                   'pmp-v3': stringMetric,
                   'pcp-v3': stringMetric,
                   'upnp-v3': stringMetric}
    });

    this.data_ = new MetricsData;
    if (storage_ !== null) {
      this.onceLoaded_ = this.storage_.load('metrics').then(
        (storedData :MetricsData) => {
          log.info('Loaded metrics from storage', storedData);

          if (storedData.version === this.data_.version) {
            // Add stored metrics to current data_, in case increment has been
            // called before storage loading is complete.
            this.data_.successes.merge(storedData.successes, this.add_);
            this.data_.attempts.merge(storedData.attempts, this.add_);
            this.data_.shutdowns.merge(storedData.shutdowns, this.add_);
            this.data_.on_gmail = mergeNet(this.data_.on_gmail, storedData.on_gmail);
            this.data_.on_facebook = mergeNet(this.data_.on_facebook,
                                              storedData.on_facebook);
            this.data_.on_github = mergeNet(this.data_.on_github, storedData.on_github);
            this.data_.on_quiver = mergeNet(this.data_.on_quiver, storedData.on_quiver);
            this.data_.on_wechat = mergeNet(this.data_.on_wchat, storedData.on_wechat);
            this.data_.on_cloud = mergeNet(this.data_.on_cloud, storedData.on_cloud);
          }
        }).catch((e :Error) => {
          // Not an error if no metrics are found storage, just use the default
          // values for success, failure, etc.
          log.info('No metrics found in storage');
        });
    }
  }

  public increment = (name :string) => {
    if (name == 'success') {
      this.data_.successes.update(1, this.add_);
      this.save_();
    } else if (name == 'attempt') {
      this.data_.attempts.update(1, this.add_);;
      this.save_();
    } else if (name == 'shutdown') {
      this.data_.shutdowns.update(1, this.add_);
    } else {
      log.error('Unknown metric ' + name);
    }
  }

  // Update how many friends are logged in on this network.
  public userCount = (network: string, userName :string, friendCount:number) => {
    // For some networks, we may only see other logged-in users.
    // Store the max user count we've seen in the last 7 days.
    if (network == 'gmail') {
      this.data_.on_gmail[userName] = max(this.data_.on_gmail[userName], friendCount);
    } else if (network == 'facebook') {
      this.data_.on_facebook[userName] = max(this.data_.on_facebook[userName], friendCount);
    } else if (network == 'github') {
      this.data_.on_github[userName] = max(this.data_.on_github[userName], friendCount);
    } else if (network == 'quiver') {
      this.data_.on_quiver[userName] = max(this.data_.on_quiver[userName], friendCount);
    } else if (network == 'wechat') {
      this.data_.on_wechat[userName] = max(this.data_.on_wechat[userName], friendCount);
    } else if (network == 'cloud') {
      this.data_.on_cloud[userName] = max(this.data_.on_cloud[userName], friendCount);
    } else {
      log.error('Unknown social network: ' + name + ' for user ' + userName);
    }
  }

  public getReport = (natInfo:uproxy_core_api.NetworkInfo) :Promise<Object> => {
    var platform = 'unknown';
    var chromeVersion = 'none';
    var firefoxVersion = 'none';
    var agent = navigator.userAgent;
    var idx :number;

    if ((idx = agent.indexOf('Firefox')) >= 0) {
      firefoxVersion = '' + parseInt(agent.slice(idx+8));
    } else if ((idx = agent.indexOf('Chrome')) >= 0) {
      chromeVersion = '' + parseInt(agent.slice(idx+7));
    }

    if (agent.indexOf('Linux') >= 0) {
      platform = 'linux';
    } else if (agent.indexOf('Android') >= 0) {
      platform = 'android';
    } else if (agent.indexOf('Macintosh') >= 0) {
      platform = 'mac';
    } else if (agent.indexOf('iOS') >= 0) {
      platform = 'ios';
    } else if (agent.indexOf('Windows') >= 0) {
      platform = 'windows';
    }

    log.info("getReport: chromeVersion: " + chromeVersion + ", firefoxVersion: "
             + firefoxVersion + ", platform: " + platform + " from user agent '"
             + navigator.userAgent + "'.");
    // Don't catch any Promise rejections here so that they can be handled
    // by the caller instead.
    return this.onceLoaded_.then(() => {
      var attempts = this.data_.attempts.reduce(0, this.add_);
      var successes = this.data_.successes.reduce(0, this.add_);
      var shutdowns = this.data_.shutdowns.reduce(0, this.add_);

      var successReport =
        this.metricsProvider_.report('success-v3', successes);
      var failRateReport =
        this.metricsProvider_.report(
          'fail-rate-v1', calcQuantile(attempts - successes, attempts));
      var shutdownReport =
        this.metricsProvider_.report('shutdown-v1', calcQuantile(
          shutdowns, successes));

      var chromeVersionReport =
        this.metricsProvider_.report('chrome-version-v1', chromeVersion);
      var firefoxVersionReport =
        this.metricsProvider_.report('ff-version-v1', firefoxVersion);
      var platformReport =
        this.metricsProvider_.report('platform-v1', platform);

      var gmailReport =
        this.metricsProvider_.report('gmail-v1',
                                     sumMetrics(this.data_.on_gmail));
      var facebookReport =
        this.metricsProvider_.report('facebook-v1',
                                     sumMetrics(this.data_.on_facebook));
      var githubReport =
        this.metricsProvider_.report('github-v1',
                                     sumMetrics(this.data_.on_github));
      var quiverReport =
        this.metricsProvider_.report('quiver-v1',
                                     sumMetrics(this.data_.on_quiver));
      var wechatReport =
        this.metricsProvider_.report('wechat-v1',
                                     sumMetrics(this.data_.on_wechat));
      var cloudReport =
        this.metricsProvider_.report('cloud-v1',
                                     sumMetrics(this.data_.on_cloud));

      var natPromises:Promise<void>[] = [];
      if (natInfo && !natInfo.errorMsg) {
        var natTypeReport =
          this.metricsProvider_.report('nat-type-v3', natInfo.natType);
        var pmpReport =
          this.metricsProvider_.report('pmp-v3', natInfo.pmpSupport.toString());
        var pcpReport =
          this.metricsProvider_.report('pcp-v3', natInfo.pcpSupport.toString());
        var upnpReport =
          this.metricsProvider_.report('upnp-v3', natInfo.upnpSupport.toString());
        natPromises = [natTypeReport, pmpReport, pcpReport, upnpReport];
      }

      return Promise.all([
        successReport, failRateReport, shutdownReport, chromeVersionReport,
        firefoxVersionReport, platformReport, gmailReport, facebookReport,
        githubReport, quiverReport, wechatReport, cloudReport
      ].concat(natPromises)).then(() => {
        return this.metricsProvider_.retrieve();
      });
    });
  }

  public reset = () => {
    this.data_.successes.reset();
    this.data_.attempts.reset();
    this.data_.shutdowns.reset();
    this.data_.on_gmail = {};
    this.data_.on_facebook = {};
    this.data_.on_github = {};
    this.data_.on_quiver = {};
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
  public static MAX_TIMEOUT = 5* ONE_DAY_MS;

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

  private sendReport_ = (natInfo:uproxy_core_api.NetworkInfo) => {
    this.metrics_.getReport(natInfo).then((payload:Object) => {
      this.onReportCallback_(payload);
    }).catch((e :Error) => {
      log.error('Error getting report', e);
    }).then(() => {
      // Set nextSendTimestamp regardless of whether metrics.getReport
      // succeeded or failed.
      this.data_.nextSendTimestamp =
          DailyMetricsReporter.getNextSendTimestamp_();
      DailyMetricsReporter.runNowOrLater_(
          this.report_.bind(this), this.data_.nextSendTimestamp);
      this.save_();
    });
  }

  private report_ = () => {
    // TODO(kennysong): Ideally we want to call getNetworkInfoObj_() as a static
    // method of uproxy_core.uProxyCore, instead of passing the function in
    // as a parameter. This can be done after the circular dependency is fixed.
    // See: https://github.com/uProxy/uproxy/issues/1660
    this.getNetworkInfoObj_().then(
      (natInfo:uproxy_core_api.NetworkInfo) => {
        this.sendReport_(natInfo);
      },
      (err:any) => {
        this.sendReport_(null);
        log.error("Daily metrics send: failed NetworkInfo: ", err);
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
    // 1 day, rough send interval.
    var MEAN_SEND_INTERVAL_MS = ONE_DAY_MS;
    var offset_ms = -Math.floor(Math.log(randomFloat) / (1 / MEAN_SEND_INTERVAL_MS));
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
