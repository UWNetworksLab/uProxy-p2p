/// <reference path='../../../../third_party/typings/index.d.ts' />

// This file defines 'handler queues'. These are an abstraction for a stream of
// events (but think of an event as an element of data to be handled) along with
// a stream of functions to handle the events. Each event is guarenteed to be
// handled, and gets a promise for the result of that event being handled. A
// function handling an event may set the function that handles future events,
// or it may stop handling events in which case the event stream will be queued
// until a handler is set.
//
// This is a bit like traditional event handlers, but each thing in the hanlder
// queue must be handled by exactly one handler (although that handler may
// itself call several functions). This allows async assignment of the handler
// along with asynchronous adding of events to the queue.
//
// CONSIDER: How efficient is a new Error? Maybe best to have rejection
// without an error since the error is not meaningful.
//
// CONSIDER: there's quite a bit of book-keeping for the resulting promises from
// a handle call. We may want a simpler version of this class that doesn't need
// to remember result values (those of type Result).
//
// CONSIDER: This is kind of similar to functional parsing. May be good to
// formalize the relationship in comments here.

import baseQueue = require('../queue/queue');

// The |QueueFeeder| is the abstraction for events to be handled.
export interface QueueFeeder<Feed,Result> {
  // Number of things in the queue to be handled.
  getLength() : number;
  // Called by code that wants |x| to be handled. Returns a promise for
  // when |x| is handled. Queues |x| until it can be handled.
  handle(x:Feed) : Promise<Result>;
}

// The |HandlerQueueStats| class contains increment-only counters
// characterizing the state and history of a |QueueHandler|.
export class HandlerQueueStats {
  // Total events ever input by the HandlerQueue.  Intent:
  //
  // queued_events + immediately_handled_events + rejected_events =
  //   total_events.
  //
  // queued_events - queued_handled_events - rejected_events = number
  //   of events in queue right now.
  total_events : number = 0;
  // Ever-queued-events
  queued_events : number = 0;
  // Events that were immediately handled (b/c there was a handler set).
  immediately_handled_events : number = 0;
  // Events that were handled after going through the queue.
  queued_handled_events : number = 0;
  // Number of events rejected in a queue clear.
  rejected_events : number = 0;
  // Number of times a handler was set on this queue (the handler was
  // previously null).
  handler_set_count : number = 0;
  // Number of times a handler was changed on this queue (the handler
  // was previously non-null).
  handler_change_count : number = 0;
  // Number of times a handler was un-set on this queue (when then
  // handler previously non-null).
  handler_clear_count : number = 0;
  // Number of times we set a new handler while we have an existing
  // promise, causing a rejection of that promise.
  handler_rejections : number = 0;
}

// The |QueueHandler| is the abstraction for the stream of functions that
// handles events.
export interface QueueHandler<Feed,Result> {
  // Clears the queue, and rejects promises for |handle| callers that added
  // entries in the queue.
  clear() : void;
  // Number of things in the queue to be handled.
  getLength() : number;
  // The |setHandler|'s handler function |f| will be called on the next element
  // until the queue is empty or the handler itself is changed (e.g. if
  // |stopHandling()| is called while handling an event then further events
  // will be queued until a new handler is set).
  setHandler(f:(x:Feed) => Promise<Result>) : void;
  // As above, but takes a sync function handler.
  setSyncHandler(f:(x:Feed) => Result) : void;
  // Sets the next function to handle something in the handler queue. Returns
  // a promise for the result of the next handled event in the queue. Note: if
  // the queue is empty, the promise resolves the next time `handle` is called
  // (assuming by then the queue isn't stopped or handler changed by then).
  setNextHandler(f:(x:Feed) => Promise<Result>) : Promise<Result>;
  // As above, but takes a sync handler.
  setSyncNextHandler(f:(x:Feed) => Result) : Promise<Result>;
  // Returns true if on of the |set*| functions has been called but
  // |stopHandling| has not. Returns false after |stopHandling| has been
  // called.
  isHandling() : boolean;
  // The queue stops being handled and all future that |handle| is called on
  // are queued. If |setSyncNextHandler| or |setAsyncNextHandler| has been
  // called, then its return promise is rejected.
  stopHandling() : void;
  // Get statistics on queue handler.
  getStats() : HandlerQueueStats;
}

// Internal helper class. Holds an object called |thing| of type |T| and
// provides a promise for a new result object of type |T2|. The idea is that
// |T2| is will be result of some async function applied to |thing|. This
// helper supports the function that gerates the new object to be known async
// (i.e. later), but still being able to promise a promise for the result
// immidiately.
//
// Assumes fulfill/reject are called exclusively and only once.
class PendingPromiseHandler<T,T2> {
  public promise   :Promise<T2>
  private fulfill_ :(x:T2) => void;
  private reject_  :(e:Error) => void;
  private completed_ :boolean;

  constructor(public thing:T) {
    // This holds the T object, and fulfills with a T2 when fulfill is called
    // with T2. The point is we can give back the promise now but fulfill can
    // be called later.
    this.promise = new Promise<T2>((F,R) => {
        this.fulfill_ = F;
        this.reject_ = R;
      });
    this.completed_ = false;
  }

  public reject = (e:Error) : void => {
    if (this.completed_) {
      console.error('reject must not be called on a completed promise.');
      return;
    }
    this.completed_ = true;
    this.reject_(e);
  }

  public handleWith = (handler:(x:T) => Promise<T2>) : void => {
    if (this.completed_) {
      console.error('handleWith must not be called on a completed promise.');
      return;
    }
    this.completed_ = true;
    handler(this.thing).then(this.fulfill_);
  }
}


// The |Queue| class provides a |QueueFeeder| and a |QueueHandler|. The idea is
// that the QueueHandler processes inputs of type |Feed| from the |QueueFeeder|
// and gives back promises for objects of type |Result|. The handle function
// takes objects of type |Feed| and promises objects of type |Result| (the
// handler may run asynchonously).
//
// When the handler is set to |null|, objects are queued up to be handled. When
// the handler is set to not a non-null function, everything in the queue is
// handled by that function. There are some convenience functions for stopping
// Handling, and hanlding just the next event/element.
//
// CONSIDER: this is a kind of co-promise, and can probably be
// extended/generalized.
export class Queue<Feed,Result>
    implements QueueFeeder<Feed,Result>, QueueHandler<Feed,Result> {
  // The queue of things to handle.
  private queue_ = new baseQueue.Queue<PendingPromiseHandler<Feed, Result>>();

  // Handler function for things on the queue. When null, things queue up.
  // When non-null, gets called on the thing to handle. When set, called on
  // everything in the queue in FIFO order.
  private handler_ :(x:Feed) => Promise<Result> = null;

  // We store a handler's promise rejection function and call it when
  // `setHandler`  is called and we had a previously promised handler. We need
  // to do this because the old handler would never fulfill the old promise as
  // it is no longer attached.
  private rejectFn_ : (e:Error) => void = null;

  // Handler statistics.
  private stats_  = new HandlerQueueStats();

  // CONSIDER: allow queue to be size-bounded? Reject on too much stuff?
  constructor() {}

  public getLength = () : number => {
    return this.queue_.length;
  }

  public isHandling = () : boolean => {
    return this.handler_ !== null;
  }

  public getStats = () : HandlerQueueStats => {
    return this.stats_;
  }

  // handle or queue the given thing.
  public handle = (x:Feed) : Promise<Result> => {
    this.stats_.total_events++;

    if (this.handler_) {
      this.stats_.immediately_handled_events++;
      return this.handler_(x);
    }

    var pendingThing = new PendingPromiseHandler(x);
    this.queue_.push(pendingThing);
    this.stats_.queued_events++;
    return pendingThing.promise;
  }

  // Run the handler function on the queue until queue is empty or handler is
  // null. Note: a handler may itself setHandler to being null, doing so
  // should pause proccessing of the queue.
  private processQueue_ = () : void => {
    while (this.handler_ && this.queue_.length > 0) {
      this.stats_.queued_handled_events++;
      this.queue_.shift().handleWith(this.handler_);
    }
  }

  // Clears the queue, and rejects all promises to handle things on the queue.
  public clear = () : void => {
    while (this.queue_.length > 0) {
      var pendingThing = this.queue_.shift();
      this.stats_.rejected_events++;
      pendingThing.reject(new Error('Cleared by Handler'));
    }
  }

  // Calling setHandler with null pauses handling and queues all objects to be
  // handled.
  //
  // If you have an unfulfilled promise, calling setHandler rejects the old
  // promise.
  public setHandler = (handler:(x:Feed) => Promise<Result>) : void => {
    if (!handler) {
      throw new Error('handler must not be null');
    }
    if (this.rejectFn_) {
      this.stats_.handler_rejections++;
      this.rejectFn_(new Error('Cancelled by a call to setHandler'));
      this.rejectFn_ = null;
    }
    if (this.handler_ === null) {
      this.stats_.handler_set_count++;
    } else {
      this.stats_.handler_change_count++;
    }
    this.handler_ = handler;
    this.processQueue_();
  }

  // Convenience function for handler to be an ordinary function without a
  // promise result.
  public setSyncHandler = (handler:(x:Feed) => Result) : void => {
    this.setHandler((x:Feed) => { return Promise.resolve(handler(x)); });
  }

  // Reject the previous promise handler if it exists and stop handling stuff.
  public stopHandling = () => {
    if (this.rejectFn_) {
      this.stats_.handler_rejections++;
      this.rejectFn_(new Error('Cancelled by a call to setHandler'));
      this.rejectFn_ = null;
    }
    if (this.handler_) {
      this.handler_ = null;
      this.stats_.handler_clear_count++;
    }
  }

  // A convenience function that takes a T => Promise<Result> function and sets
  // the handler to a function that will return the promise for the next thing
  // to handle and then unset the handler after that so that only the next
  // thing in the queue is handled.
  //
  // Note: this sets the Handler to fulfill this promise when there is
  // something to handle.
  public setNextHandler = (handler:(x:Feed) => Promise<Result>)
      : Promise<Result> => {
    return new Promise((F,R) => {
      this.setHandler((x:Feed) : Promise<Result> => {
        // Note: we don't call stopHandling() within this handler because that
        // would reject the promise we're about to fulfill.
        this.handler_ = null;
        this.rejectFn_ = null;
        this.stats_.handler_clear_count++;
        var resultPromise = handler(x);
        resultPromise.then(F);
        return resultPromise;
      });
      if (this.handler_) {
        // If |handler| has not already run, and removed itself, leave a
        // rejection function behind as well.
        this.rejectFn_ = R;
      }
    });
  }

  // Convenience function for handling next element with an ordinary function.
  public setSyncNextHandler = (handler:(x:Feed) => Result) : Promise<Result> => {
    return this.setNextHandler((x:Feed) => {
        return Promise.resolve(handler(x));
      });
  }

}  // class Queue
