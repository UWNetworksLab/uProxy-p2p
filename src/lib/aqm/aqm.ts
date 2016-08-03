/// <reference path='../../../../third_party/typings/browser.d.ts' />

import logging = require('../logging/logging');

var log :logging.Log = new logging.Log('aqm');

// A general interface for Active Queue Manager algorithms.
// <T> must include everything required to send a packet.
// The number of bytes per packet is not exposed, so all 
// implementations of this interface must measure the queue
// length in number of packets.  This seems appropriate for our
// use case: managing an IPC queue whose CPU cost is proportional
// to the packet rate, not the byte rate.
export interface AQM<T> {
  // Send a packet that is part of a specified flow.  The AQM
  // will determine whether to use |fastSender| or |tracedSender|.
  // The flow identifier allows implementations of fair queueing.
  // Returns true if the packet was sent, or false if it was dropped.
  send(flow:number, args:T) : boolean;
}

// A null AQM: just uses a fast send and lets the queue grow without
// bound.
export class Null<T> implements AQM<T> {
  constructor(private send_:(args:T) => void) {}

  public send(flow:number, args:T) : boolean {
    this.send_(args);
    return true;
  }
}

// Implements "tail drop", i.e. a hard limit on queue length.
// Uses a traced send.
export class TailDrop<T> implements AQM<T> {
  private length_ = 0;

  constructor(private send_:(args:T) => Promise<void>,
              private maxLength_:number) {}

  public send(flow:number, args:T) : boolean {
    if (this.length_ >= this.maxLength_) {
      return false;
    }
    ++this.length_;
    this.send_(args).then(() => {
      --this.length_;
    }, log.error);
    return true;
  }
}

// When |tracingFraction === 1|, this class implements the classic
// Random Early Detection AQM algorithm:
//   http://www.icir.org/floyd/papers/early.pdf
// When |tracingFraction| is reduced, this becomes a new variation
// on RED that only uses the traced sender for occasional "sentinel"
// packets.  This results in Poisson-process sampling of the queue
// length, which is noisier than true RED but avoids acking every
// send call, which would double the IPC cost.
export class REDSentinel<T> implements AQM<T>{
  // RED uses an exponential moving average.  This weight
  // corresponds to a sliding window of 500 packets, which
  // is the value from the original paper.
  private static WEIGHT_ = 1 / 500;

  // When no packets are in the queue, the moving average
  // should decay toward zero.  This constant sets the
  // decay rate, based on the approximation that at full speed
  // we would send about 1 packet per millisecond.
  private static SENDRATE_ = 1;

  private length_ = 0;
  private avg_ = 0;
  private emptyDate_ = new Date();
  private emptyAvg_ = 0;

  private counter_ = 0|0;  // 32-bit int, asm.js style

  constructor(private tracedSend_:(args:T) => Promise<void>,
              private fastSend_:(args:T) => void,
              private tracingFraction_:number,
              private dropThreshold_:number) {}

  private updateAvg_() {
    if (this.length_ > 0) {
      this.avg_ = (1 - REDSentinel.WEIGHT_) * this.avg_
          + REDSentinel.WEIGHT_ * this.length_;
    } else {
      var now = new Date();
      var slots = (now.getTime() - this.emptyDate_.getTime())
          * REDSentinel.SENDRATE_;
      this.avg_ = this.emptyAvg_ * Math.pow(1 - REDSentinel.WEIGHT_, slots);
    }
  }

  public send(flow:number, args:T) : boolean {
    this.updateAvg_();
    if (this.avg_ >= this.dropThreshold_ &&
        this.avg_ - this.dropThreshold_ >
            this.dropThreshold_ * Math.random()) {
      return false;
    }

    this.counter_ = (this.counter_ + 1)|0;

    if (Math.random() >= this.tracingFraction_) {
      this.fastSend_(args);
    } else {
      var counterAtSend = this.counter_;
      this.tracedSend_(args).then(() => {
        this.length_ = (this.counter_ - counterAtSend)|0;
        if (this.length_ === 0) {
          this.emptyDate_ = new Date();
          this.emptyAvg_ = this.avg_;
        }
      }, log.error);
    }

    return true;
  }
}

// This class implements something like the new CoDel AQM algorithm:
//   https://tools.ietf.org/html/draft-ietf-aqm-codel-01
// This implementation is different from true CoDel because
//  (1) It uses fractional tracing
//  (2) It uses tail drop (head drop is not possible in this model)
//  (3) It does not have a byte counter
export class CoDelIsh<T> implements AQM<T>{
  // CoDel works by checking the minimum delay in each interval.
  // If there is congestion at the end of the interval, the next
  // packet is dropped.
  // The duration of the interval starts at 100 milliseconds, but gets
  // shorter when congestion is detected.
  private static BASE_INTERVAL_ = 100;

  // Drop level 1 means that we are in "good queue".
  // Higher drop levels indicate the number of consecutive intervals
  // that were judged bad.
  private dropLevel_:number = 1;
  // Whether to drop the next packet.
  private dropNext_:boolean = false;

  // The time at which the current interval will end.
  // The initial value (0) corresponds to the epoch, so the first
  // packet will cause the after-end-of-interval logic to run.
  private deadline_:number = 0;
  // The number of send calls so far in this interval.
  private sent_:number = 0;
  // The minimum delay observed so far in this interval.
  private minDelay_:number = Infinity;

  // Trace every nth packet, by adding this.tracingFraction modulo 1,
  // and tracing after the value wraps.  Setting an initial value
  // of 1 ensures that the first packet is traced.
  private traceCounter_ = 1;

  // Method to run at the end of an interval.
  private endOfInterval_(now:number) {
    if (this.sent_ <= 1 ||  // Substitutes for CoDel's MTU threshold
        this.minDelay_ <= this.targetDelay_) {
      // Good queue.  Reduce the drop level by 2.
      this.dropLevel_ = Math.max(1, this.dropLevel_ - 2);
      this.dropNext_ = false;
    } else {
      // Bad queue.  Drop a packet and shorten the interval.
      this.dropNext_ = true;
      ++this.dropLevel_;
    }
    this.minDelay_ = Infinity;
    // Always trace the first packet of the next interval.
    this.traceCounter_ = 1;
    // In CoDel, the interval length is inversely proportional to
    // the square root of the drop level.
    this.deadline_ = now +
        CoDelIsh.BASE_INTERVAL_ / Math.sqrt(this.dropLevel_);
  }

  // targetDelay_ is the target total queueing delay in milliseconds.
  constructor(private tracedSend_:(args:T) => Promise<void>,
              private fastSend_:(args:T) => void,
              private tracingFraction_:number,
              private targetDelay_:number) {}

  public send(flow:number, args:T) : boolean {
    ++this.sent_;
    if (this.dropNext_) {
      // Drop the first packet of the interval
      this.dropNext_ = false;
      return false;
    }

    if (this.traceCounter_ >= 1) {
      this.traceCounter_ -= 1;

      var enqueueTime = Date.now();
      this.tracedSend_(args).then(() => {
        // This runs after a packet is dequeued and acked back from
        // the core.
        var endTime = Date.now();
        var sojourn = endTime - enqueueTime;
        this.minDelay_ = Math.min(this.minDelay_, sojourn);

        if (enqueueTime > this.deadline_) {
          this.endOfInterval_(endTime);
        }
      }, log.error);
    } else {
      this.fastSend_(args);
    }
    this.traceCounter_ += this.tracingFraction_;

    return true;
  }
}
