// benchmark.ts benchmarks the proxy.  It should be running on localhost:9999

/// <reference path='../../../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../../third_party/typings/request/request.d.ts' />
//// <reference path='../../../third_party/typings/node/node.d.ts' />

import request = require('request');
import util = require('util');
import Agent = require('../../../third_party/socks5-http-client/agent');
var shttpagent : Agent.Socks5ClientHttpAgent = require('socks5-http-client/lib/Agent');

export module Benchmark {
  export class Bucket {
    upperLimit : number;
    count : number;
    constructor(up : number, cnt : number) {
      this.upperLimit = up;
      this.count = cnt;
    }
  };

  export class BasicStats {
    max : number;
    min : number;
    mean : number;
    median : number;
    count: number;
    constructor(values: number[]) {
      this.min = values[0];
      this.max = values[0];
      var sum = 0;
      var n = values.length;
      this.count = n;
      for (var i = 0; i < n; i++) {
        sum += values[i];
        if (values[i] < this.min) {
          this.min = values[i];
        }
        if (values[i] > this.max) {
          this.max = values[i];
        }
      }
      this.median = this.calcMedian(values);
      this.mean = sum / n;
    }

    private calcMedian(values : number[]) : number {
      var sorted = values.sort();
      var len = values.length;
      if (len < 2) {
        return values[0];
      }
      if (len % 2) {
        // Odd number of elements, choose center.
        return sorted[ Math.floor((len/2) + 1) ];
      } else {
        // Even number of elements, average two middle ones.
        return (sorted[len/2] + sorted[(len/2)+1]) / 2;
      }
    }

    private fmtNumber(n: number) : string {
      if (n) {
        return n.toFixed(2);
      } else {
        return "undef!";
      }
    }

    public summary () : string {
      return util.format("[total: %d, min: %d, med: %d, mean: %d, max: %d]",
                         this.count, this.min, this.fmtNumber(this.median),
                         this.fmtNumber(this.mean), this.max);
    }
  };

  export class Histogram {
    private buckets_ : Bucket[];
    private count_ : number;

    constructor(nbuckets:number, max : number) {
      this.buckets_ = new Array<Bucket>();
      this.count_ = 0;
      var step = max / nbuckets;
      for (var i = 0; i < nbuckets - 1; i++) {
        this.buckets_[i] = new Bucket(step * i, 0);
      }
      this.buckets_[nbuckets - 1] = new Bucket(Number.MAX_VALUE, 0);
    }

    public addValue(num : number) : void {
      // This isn't fast.
      for (var i = 0;i < this.buckets_.length; i++) {
        if (num < this.buckets_[i].upperLimit) {
          this.buckets_[i].count++;
          return;
        }
      }
    }

    public addValues(nums : number[]) : Histogram {
      for (var i = 0; i < nums.length; i++) {
        this.addValue(nums[i]);
      }
      return this;
    }

    public getValues() : Bucket[] {
      return this.buckets_;
    }

    public getPoints() : number[][] {
      var buckets = new Array<number[]>();
      for (var i = 0; i < this.buckets_.length; i++) {
        var prev = 0;
        if (i > 0) { prev = this.buckets_[i-1].upperLimit; }
        buckets.push([prev, this.buckets_[i].count]);
      }
      return buckets;
    }
  };

  // Request result.  We separate out timeouts from the general
  // class of failure, as it probably indicates a bug in the SUT's
  // implementation.
  export enum Result {
    RES_SUCCESS,
    RES_FAILURE,
    RES_TIMEOUT
  };

  // A container for raw latency values for a single kind of test.
  // Keeps separate value lists for each result.
  export class DataVector {
    public values : Array<number>[];
    constructor() {
      this.values = [
        new Array<number>(),  // RES_SUCCESS
        new Array<number>(),  // RES_FAILURE
        new Array<number>(),  // RES_TIMEOUT
      ];
    }

    addValue(latency: number, result: Result) {
      this.values[result].push(latency);
    }

    addValues(latencies: number[], result: Result) {
      for (var i = 0; i < latencies.length; i++) {
        this.values[result].push(latencies[i]);
      }
    }
  };

  // A result for testing a single 'kind' of URL.
  export class TestResult {
    public requestSize : number;
    public raw : DataVector;
    public histogram : Histogram[];
    constructor(size: number, successes: number[], failures: number[],
                timeouts: number[], nbuckets: number, max: number) {
      this.requestSize = size;
      this.raw = new DataVector();
      this.histogram = new Array<Histogram>();
      var suc_hist = new Histogram(nbuckets, max);
      var fail_hist = new Histogram(nbuckets, max);
      var to_hist = new Histogram(nbuckets, max);

      suc_hist.addValues(successes);
      fail_hist.addValues(failures);
      to_hist.addValues(timeouts);

      this.histogram.push(suc_hist);
      this.histogram.push(fail_hist);
      this.histogram.push(to_hist);

      this.raw.addValues(successes, Result.RES_SUCCESS);
      this.raw.addValues(failures, Result.RES_FAILURE);
      this.raw.addValues(timeouts, Result.RES_TIMEOUT);
    }
  };

  // Data maintained about an in-flight HTTP request.
  class Request {
    public requestSize : number;
    public requestSizeIndex : number;
    public requestTime : number;
    public requestNum : number;
    public url : string
    constructor(url : string, sz : number, idx: number, num : number) {
      this.requestTime = Date.now();
      this.requestSizeIndex = idx;
      this.requestSize = sz;
      this.url = url;
      this.requestNum = num;
    }
  };

  export class RequestManager {
    // TODO: Size concurrency for underlying runtime.
    private concurrency = 1;
    private histoNumBuckets = 16;
    private histoMax = 100;
    private kTimeoutMS = 30000;  // 30 sec timeout.
    private kMaxTimeouts = 10;  // max number of timeouts before
    // aborting.
    private kWatchdogInterval = 500;  // check 2 times/sec.
    private latencies_ : DataVector[];
    private sizes_: number[];
    private request_queue_ : number[];
    private running_requests_ : Request[];
    // When waiting for all concurrent requests to finish, keep
    // count of how many already have.
    // 'this.concurrency - this.finished_concurrent_requests_'
    // is how many more we have to wait for.
    private finished_concurrent_requests_ : number;
    private result_callback_ : Function;
    private timeout_count_ : number;
    private request_counter_ : number;
    private verbosity_: number;

    constructor(sizes: number[]) {
      this.latencies_ = new Array<DataVector>();
      this.sizes_ = sizes;
      this.request_queue_ = [];
      this.request_counter_ = 0;
      this.result_callback_ = null;
      this.running_requests_ = new Array<Request>();
      for (var i = 0; i < sizes.length; i++) {
        this.latencies_.push(new DataVector);
      }
    }

    public configureDefaults(conc: number,
                             nbuckets: number,
                             max: number,
                             verbosity: number,
                             max_timeouts: number) {
      this.concurrency = conc;
      this.histoNumBuckets = nbuckets;
      this.histoMax = max;
      this.verbosity_ = verbosity;
      this.kMaxTimeouts = max_timeouts;
    }

    private finishRequest(requestIndex: number, err: any, response: any, body: any) {
      var request_in_error : boolean = err != null;
      var req = this.running_requests_[requestIndex];
      if (req == null) {
        console.log("Getting a result back for a request that no longer " +
                    "exists.  Race between timeouts?");
        return;
      }

      var result_time = Date.now();
      var latency_ms = result_time - req.requestTime;

      // first verify that the body is fully-formed
      if (!request_in_error && (!body || !body.length || body.length != req.requestSize)) {
          request_in_error = true;
      }

      if (req.requestTime < 0) {
        this.latencies_[req.requestSizeIndex].addValue(this.kTimeoutMS,
                                                       Result.RES_TIMEOUT);
      } else if (request_in_error) {
        // TODO: Look up error codes for this.
        this.latencies_[req.requestSizeIndex].addValue(latency_ms,
                                                       Result.RES_FAILURE);
        var body_length = -1;
        if (body) {
          body_length = body.length;
        }
        console.log("--> finishRequest: got err: " + err + ", body length was "
                    + body.length + ", wanted size: " + req.requestSize +
                    ", on url " + req.url);
      } else {
        this.latencies_[req.requestSizeIndex].addValue(latency_ms,
                                                       Result.RES_SUCCESS);
        if (this.verbosity_ > 0) {
          process.stdout.write("[" + latency_ms + " ms]\t");
        }
      }

      this.runATest(requestIndex);
    }

    public startRequest(requestIndex: number, sizeIndex: number) : void {
      var size = this.sizes_[sizeIndex];
      var self = this;
      var url = 'http://localhost:8080/' + size;
      this.request_counter_++;
      this.running_requests_[requestIndex] = new Request(url, size, sizeIndex,
                                                         this.request_counter_);
      request({
        url: 'http://localhost:8080/' + size,
        agentClass: Agent,
        agentOptions: new shttpagent({
          socksHost: 'localhost',
          socksPort: 9999
        })
      }, function (err, response, body) {
        self.finishRequest(requestIndex, err, response, body);
      });
    }

    public runATest(requestIndex: number) : void {
      if (this.timeout_count_ > 0 && this.request_queue_.length > 0) {
        var queue_head = this.request_queue_[0];
        this.request_queue_.shift();
        this.startRequest(requestIndex, queue_head);
      } else if (this.finished_concurrent_requests_ < this.concurrency) {
        this.finished_concurrent_requests_++;
        this.running_requests_[requestIndex] = null;
      }

      if (this.finished_concurrent_requests_ == this.concurrency) {
        if (this.verbosity_ > 0) {
          console.log("\nTest run complete.  Generating results");
        }
        var results = new Array<TestResult>();
        for (var sz = 0; sz < this.sizes_.length; sz++) {
          results.push(new TestResult(this.sizes_[sz],
                                      this.latencies_[sz].values[0],
                                      this.latencies_[sz].values[1],
                                      this.latencies_[sz].values[2],
                                      this.histoNumBuckets,
                                      this.histoMax));
        }
        if (this.result_callback_ != null) {
          var cb = this.result_callback_;
          this.result_callback_ = null;
          cb(results);
        }
      }
    }

    // Scan the running requests for anything that's timed out.
    private watchDog() {
      var now = Date.now();
      var num_completed_requests = 0;
      for (var r = 0; r < this.running_requests_.length; r++) {
        var req = this.running_requests_[r];
        if (req != null) {
          if (now - req.requestTime > this.kWatchdogInterval) {
            req.requestTime = -1;  // mark as timed out
            console.log("*ruff! Timing out request " + req.requestNum
                        + " on slot " + r);
            this.finishRequest(r, null, null, null);
            this.timeout_count_--;
          }
        } else {
          num_completed_requests++;
        }
      }

      // This setTimeout also keeps the node.js process running.
      if (!this.running_requests_.length ||
          num_completed_requests < this.running_requests_.length) {
        var self = this;
        setTimeout(function() { self.watchDog(); }, this.kWatchdogInterval);
      }
    }

    private initForTestRun() {
      this.timeout_count_ = this.kMaxTimeouts;
      this.running_requests_ = new Array<Request>();
      this.finished_concurrent_requests_ = 0;
      this.watchDog();
    }

    public runTests (numPerSize : number, callback: Function) {
      this.initForTestRun();
      this.result_callback_ = callback;

      // Queue the tests.
      for (var sz = 0; sz < this.sizes_.length; sz++) {
        for (var run = 0; run < numPerSize; run++) {
          this.request_queue_.push(sz);
        }
      }

      // Start them.
      for (var c = 0; c < this.concurrency; c++) {
        this.runATest(c);
      }
    }
  };

  export interface BenchmarkStrategy {
    configure(requestManager: RequestManager) : void;
    run() : void;
  };
}  // module Benchmark
