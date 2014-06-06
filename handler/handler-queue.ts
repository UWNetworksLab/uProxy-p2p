//
module Handler {

  // Queue up stuff while the handler is set to null. When set to not null
  // handle all the stuff that got queued.
  // (TODO: a kind of opposite to a promise, can probably be extended)
  class Queue<T> {
    // the Queue of things to handle.
    private queue_ :T[] = [];

    // handler for things on the queue.
    private handler_ :(T) => void = null;

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
    private measure :number = 0;
    private accumulate :NumberAccumulator<T>;

    constructor() {}

    // Calling setHandler with null pauses handling and queue all objects to be
    // handled.
    //
    // If you have an unfulfilled promise, calling setHandler rejects the old
    // promise.
    public setHandler = (handler:(T) => void) : void => {
      if (rejectFn_) {
        // Question: How efficient is new Error? Maybe best to have rejection
        // with error.
        rejectFn_(new Error('Cancelled by a call to setHandler'));
        rejectFn_ = null;
      }
      this.handler_ = handler;
      processQueue();
    }

    private processQueue = () : void => {
      // Note: a handler may itself setHandler to being null, doing so should
      // pause proccessing of the queue.
      while(this.handler_ && this.queue_.length > 0) {
        this.handler_(this.queue_.shift());
      }
    }

    public clearQueue = () : void => {
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

    // Note: this sets the Handler to fulfil this promise when there is
    // something to handle.
    public makePromise = () :Promise<T> => {
      var fulfillFn :(x:T) => void;
      var promiseForNextHandle = new Promise((F,R) => {
          fulfillFn = F;
          this.rejectFn_ = R;
      };
      this.setHandler((x:T) => {
        // Note: we don't call setHandler here because it is responsible for
        // cancelling the last promise if one was made: you only get one promise
        // to handle, so if we called it, we'd reject the promise we are
        // supposed to be fulfilling!
        this.handler_ = null;
        this.rejectFn_ = null;
        fulfillFn(x);
      });

      return promiseForNextHandle;
    }
  }

}
