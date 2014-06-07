/// <reference path='../third_party/promise/promise.d.ts' />

// Event Handler tools.
module Handler {

  // Queue up event the handler is set to null. When set to not null handle all
  // the stuff that was queued. (CONSIDER: this is a kind of co-promise, and can
  // probably be extended/generalized)
  export class Queue<T> {
    // the Queue of things to handle.
    private queue_ :T[] = [];

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

    // Run the handler function on the queue until queue is empty or handler is
    // null. Note: a handler may itself setHandler to being null, doing so
    // should pause proccessing of the queue.
    private processQueue_ = () : void => {
      while(this.handler_ && this.queue_.length > 0) {
        this.handler_(this.queue_.shift());
      }
    }

    public clear = () : void => {
      this.queue_ = [];
    }

    public getLength = () : number => {
      return this.queue_.length;
    }

    public handle = (x:T) : void => {
      if(this.handler_) {
        this.handler_(x);
        return
      }
      this.queue_.push(x);
    }

    // Make promise gives a promise for the next data to be handled.
    //
    // Note: this sets the Handler to fulfil this promise when there is
    // something to handle.
    public makePromise = () :Promise<T> => {
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
  }

}
