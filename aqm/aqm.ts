/// <reference path='../../../third_party/typings/es6-promise/es6-promise.d.ts' />

// A general interface for Active Queue Manager algorithms.
// <T> must include everything required to send a packet.
// The number of bytes per packet is not exposed, so all 
// implementations of this interface must measure the queue
// length in number of packets.  This seems appropriate for our
// use case: managing an IPC queue whose cost appears to be
// dominated by packet rate, not byte rate.
export interface AQM<T> {
  // This function must be set by the user before calling send.
  // It should add a packet to the send queue, and also return
  // a Promise that resolves after the packet exits the queue.
  tracedSender:(args:T) => Promise<void>;

  // This function must be set by the user before calling send.
  // It should enqueue a packet to be sent.
  fastSender:(args:T) => void;

  // The fraction of sends that will use tracedSender.
  // Implementations of AQM should prepopulate this, but it may
  // be changed by the user of the class.
  tracingFraction:number;

  // Send a packet that is part of a specified flow.  The AQM
  // will determine whether to use |fastSender| or |tracedSender|.
  // The flow identifier allows implementations of fair queueing.
  send(flow:number, args:T) : boolean;
}

// A null AQM: just uses the fast sender and lets the queue
// grow without bound.
export class Null<T> implements AQM<T> {
  public tracedSender:(args:T) => Promise<void>;  // Ignored
  public fastSender:(args:T) => void;
  public tracingFraction:number = 0;  // Ignored

  public send(flow:number, args:T) : boolean {
    this.fastSender(args);
    return true;
  }
}

// Implements "tail drop", i.e. a hard limit on queue length.
// Always uses the traced sender.
export class TailDrop<T> implements AQM<T> {
  public tracedSender:(args:T) => Promise<void>;
  public fastSender:(args:T) => void;  // Ignored
  public tracingFraction:number = 1;  // Ignored

  private length_ = 0;

  constructor(private maxLength_:number) {}

  public send(flow:number, args:T) : boolean {
    if (this.length_ >= this.maxLength_) {
      return false;
    }
    ++this.length_;
    this.tracedSender(args).then(() => {
      --this.length_;
    });
    return true;
  }
}  // class TailDrop

// When |tracingFraction === 1|, this class implements the classic
// Random Early Detection AQM algorithm:
//   http://www.icir.org/floyd/papers/early.pdf
// When |tracingFraction| is reduced, this becomes a new variation
// on RED that only uses the traced sender for occasional "sentinel"
// packets.  This results in Poisson-process sampling of the queue
// length, which is noisier than true RED but avoids acking every
// send call, which would double the IPC cost.
export class REDSentinel<T> implements AQM<T>{
  public tracedSender:(args:T) => Promise<void>;
  public fastSender:(args:T) => void;
  public tracingFraction:number = 0.2;

  // RED uses an exponential moving average.  This weight
  // corresponds to a sliding window of 500 packets, which
  // is the value from the original paper.
  private static WEIGHT_ = 1 / 500;

  // When no packets are in the queue, the moving average
  // should decay toward zero.  This constant sets the
  // decay rate from the approximation that at full speed
  // we would send about 1 packet per millisecond.
  private static SENDRATE_ = 1;

  private length_ = 0;
  private avg_ = 0;
  private emptyDate_ = new Date();
  private emptyAvg_ = 0;

  private counter_ = 0|0;  // 32-bit int

  constructor(private dropThreshold_:number) {}

  private updateAvg_() {
    if (this.length_ > 0) {
      this.avg_ = (1 - REDSentinel.WEIGHT_) * this.avg_
          + REDSentinel.WEIGHT_ * this.length_;
    } else {
      var now = new Date();
      var slots = (now.getTime() - this.emptyDate_.getTime()) * REDSentinel.SENDRATE_;
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

    if (Math.random() >= this.tracingFraction) {
      this.fastSender(args);
    } else {
      var counterAtSend = this.counter_;
      this.tracedSender(args).then(() => {
        this.length_ = (this.counter_ - counterAtSend)|0;
        if (this.length_ === 0) {
          this.emptyDate_ = new Date();
          this.emptyAvg_ = this.avg_;
        }
      });
    }

    return true;
  }
}  // class REDSentinel
