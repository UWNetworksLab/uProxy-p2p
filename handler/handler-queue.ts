/// <reference path='../third_party/promise/promise.d.ts' />

// Event Handler tools.
module Handler {

  export class PendingThing<T> {
    public promise :Promise<void>
    public fulfill :() => void;
    public reject :(e:Error) => void;

    constructor(public thing:T) {
      this.promise = new Promise<void>((F,R) => {
          this.fulfill = F;
          this.reject = R;
        });
    }
  }

  // Queue up event the handler is set to null. When set to not null handle all
  // the stuff that was queued. (CONSIDER: this is a kind of co-promise, and can
  // probably be extended/generalized)
  export class Queue<T> {
    // the Queue of things to handle.
    private queue_ :PendingThing<T>[] = [];

    // handler for things on the queue.
    private handler_ :(x:T) => void = null;

    // We store a handler's promise rejection function and cal it when
    // setHandler is called for an unfullfilled promise. We need to do this
    // because the old handler that would fulfill the promise is no longer
    // attached, sothe promise may never then be fulfilled.
    //
    // Note: we could try to generalise to event handling (many handlers),  but
    // there is some tricky questions for how long to queue stuff: it would need
    // explicitly start/stop queueing operations or some such. (having a handler
    // might no longer double as a mechanism to know that we are ready to handle
    // stuff: you'd have to deal with promiseHandling vs other).
    //
    // Invaiant: rejectFn_ == null iff handlePromise_ == null;
    private rejectFn_ : (e:Error) => void = null;

    // For measuring accumulation of things to handle.
    // private measure_ :number = 0;
    // private accumulate_ :NumberAccumulator<T>;

    constructor() {}

    public getLength = () : number => {
      return this.queue_.length;
    }

    // handle or queue the given thing.
    public handle = (x:T) : Promise<void> => {
      if(this.handler_) {
        this.handler_(x);
        return Promise.resolve();
      }
      var pendingThing = new PendingThing(x);
      this.queue_.push(pendingThing);
      return pendingThing.promise;
    }

    // Run the handler function on the queue until queue is empty or handler is
    // null. Note: a handler may itself setHandler to being null, doing so
    // should pause proccessing of the queue.
    private processQueue_ = () : void => {
      while(this.handler_ && this.queue_.length > 0) {
        var pendingThing = this.queue_.shift();
        this.handler_(pendingThing.thing);
        pendingThing.fulfill();
      }
    }

    // Rejects everything on the queue.
    public clear = () : void => {
      while(this.queue_.length > 0) {
        var pendingThing = this.queue_.shift();
        pendingThing.reject(new Error('Cleared by Handler'));
      }
    }

    // Make promise for when the next call to handle is made.
    //
    // Note: this sets the Handler to fulfil this promise when there is
    // something to handle.
    public onceHandler = () : Promise<T> => {
      return new Promise((F,R) => {
        this.setHandler((x:T) => {
          // Note: we don't call setHandler here because it is responsible for
          // cancelling the last promise if one was made: you only get one promise
          // to handle, so if we called it, we'd reject the promise we are
          // supposed to be fulfilling!
          this.handler_ = null;
          this.rejectFn_ = null;
          F(x);
        });
        this.rejectFn_ = R;
      });
    }

    // Calling setHandler with null pauses handling and queue all objects to be
    // handled.
    //
    // If you have an unfulfilled promise, calling setHandler rejects the old
    // promise.
    public setHandler = (handler:(x:T) => void) : void => {
      if (this.rejectFn_) {
        // Question: How efficient is new Error? Maybe best to have rejection
        // with error.
        this.rejectFn_(new Error('Cancelled by a call to setHandler'));
        this.rejectFn_ = null;
      }
      this.handler_ = handler;
      this.processQueue_();
    }

  }  // class Queue

}  // module Handler
