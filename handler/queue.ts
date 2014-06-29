/// <reference path='../third_party/promise/promise.d.ts' />

// This file defines handler queues. These are like event queue, but events are
// queued and must be handled by exactly one handler. This allows async
// assignment of the handler along with adding events to the queue.
//
// CONSIDER: How efficient is a new Error? Maybe best to have rejection
// without an error since the error is not meaningful.
//
// CONSIDER: there's quite a bit of book-keeping for the resulting promises from
// a handle call. We may want a simpler version of this class that doesn't need
// to remember result values (those of type T2).
module Handler {

  // Internal helper class. Holds an object called |thing| of type |T| and a
  // promise for a new result object of type |T2|. The idea is that |T2| is a
  // result of some async function applied to |thing|. This supports the
  // function that gerates the new object to be applied async (later) too.
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
        console.error('handleWith must not be called on a completed promise.');
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

  // Queue up events to be handled. The handler is a function that takes objects
  // of type |T| and promises objects of type |T2| (the handler may run async).
  // When the handler is set to |null|, objects are queued up to be handled.
  // When the handler is set to not a non-null function, everything in the queue
  // is handled by that function. There are convenience functions
  //
  // CONSIDER: this is a kind of co-promise, and can probably be
  // extended/generalized.
  export class Queue<T,T2> {
    // The queue of things to handle.
    private queue_ :PendingPromiseHandler<T, T2>[] = [];

    // Handler function for things on the queue. When null, things queue up.
    // When non-null, gets called on the thing to handle. When set, called on
    // everything in the queue in FIFO order.
    private handler_ :(x:T) => Promise<T2> = null;

    // We store a handler's promise rejection function and call it when
    // `setHandler`  is called and we had a previously promised handler. We need
    // to do this because the old handler would never fulfill the old promise as
    // it is no longer attached.
    private rejectFn_ : (e:Error) => void = null;

    // CONSIDER: allow queue to be size-bounded? Reject on too much stuff?
    constructor() {}

    public getLength = () : number => {
      return this.queue_.length;
    }

    public isHandling = () : boolean => {
      return this.handler_ == null;
    }

    // handle or queue the given thing.
    public handle = (x:T) : Promise<T2> => {
      if(this.handler_) {
        return this.handler_(x);
      }
      var pendingThing = new PendingPromiseHandler(x);
      this.queue_.push(pendingThing);
      return pendingThing.promise;
    }

    // Run the handler function on the queue until queue is empty or handler is
    // null. Note: a handler may itself setHandler to being null, doing so
    // should pause proccessing of the queue.
    private processQueue_ = () : void => {
      while(this.handler_ && this.queue_.length > 0) {
        this.queue_.shift().handleWith(this.handler_);
      }
    }

    // Rejects everything on the queue.
    public clear = () : void => {
      while(this.queue_.length > 0) {
        var pendingThing = this.queue_.shift();
        pendingThing.reject(new Error('Cleared by Handler'));
      }
    }

    // Calling setHandler with null pauses handling and queues all objects to be
    // handled.
    //
    // If you have an unfulfilled promise, calling setHandler rejects the old
    // promise.
    public setAsyncHandler = (handler:(x:T) => Promise<T2>) : void => {
      if (this.rejectFn_) {
        this.rejectFn_(new Error('Cancelled by a call to setHandler'));
        this.rejectFn_ = null;
      }
      this.handler_ = handler;
      this.processQueue_();
    }

    // Convenience function for handler to be an ordinary function without a
    // promise result.
    public setSyncHandler = (handler:(x:T) => T2) : void => {
      this.setAsyncHandler((x:T) => { return Promise.resolve(handler(x)); });
    }

    // Reject the previous promise handler if it exists and stop handling stuff.
    public stopHandling = () => {
      if (this.rejectFn_) {
        this.rejectFn_(new Error('Cancelled by a call to setHandler'));
        this.rejectFn_ = null;
      }
      this.handler_ = null;
    }

    // A convenience function that takes a T => Promise<T2> function and sets
    // the handler to a function that will return the promise for the next thing
    // to handle and then unset the handler after that so that only the next
    // thing in the queue is handled.
    //
    // Note: this sets the Handler to fulfill this promise when there is
    // something to handle.
    public setAsyncNextHandler = (handler:(x:T) => Promise<T2>)
        : Promise<T2> => {
      return new Promise((F,R) => {
        this.setAsyncHandler((x:T) : Promise<T2> => {
          // Note: we don't call stopHandling() within this handler because that
          // would reject the promise we're about to fulfill.
          this.handler_ = null;
          this.rejectFn_ = null;
          var resultPromise = handler(x);
          resultPromise.then(F);
          return resultPromise;
        });
        this.rejectFn_ = R;
      });
    }

    // Convenience function for handling next element with an ordinary function.
    public setSyncNextHandler = (handler:(x:T) => T2) : Promise<T2> => {
      return this.setAsyncNextHandler((x:T) => {
          return Promise.resolve(handler(x));
        });
    }


  }  // class Queue

}  // module Handler
