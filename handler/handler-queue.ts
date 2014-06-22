/// <reference path='../third_party/promise/promise.d.ts' />

// Event Handler tools.
module Handler {

  export interface FunctionOf1Arg<T,T2> { (x:T) : T2; }
  export interface PromiseFunctionOf1Arg<T,T2> { (x:T) : Promise<T2>; }

  // Abstract interface for an event handler, where each handling function
  // results in a T2 object, and by handling all events, an object of type T3 is
  // produced.
  export interface EventHandler<T,T2,T3> {
    add     :(f:(x:T) => T2) => void;
    remove  :(f:(x:T) => T2) => void;
    handle  :(x:T) => T3;
  }

  // Basic class to hold event handler functions.
  export class EventHandlerHolder<T,T2> {
    constructor() {}
    public handlers :FunctionOf1Arg<T,T2>[] = [];
    public add = (f:(x:T) => T2) : void => {
      this.handlers.push(f);
    }
    public remove = (f:(x:T) => T2) : void => {
      var index = this.handlers.indexOf(f);
      if(index > -1) {
        this.handlers.splice(index, 1);
      }
    }
  }

  // Simple Event handler class where the event handler takes an argument T and
  // doesn't return anything.
  export class UnitEventHandler<T> extends EventHandlerHolder<T,void>
      implements EventHandler<T,void,void> {

    constructor() { super(); }

    public handle = (x:T) : void => {
      this.handlers.forEach((f) => f(x));
    }
  }

  // Event handler for when the events return promise, and when you handle
  // something you want all the results.
  export class PromisedEventHandler<T, T2>
      extends EventHandlerHolder<T,Promise<T2>>
      implements EventHandler<T,Promise<T2>,Promise<T2[]>> {

    constructor() { super(); }

    public handle = (x:T) : Promise<T2[]> => {
      var promises :Promise<T2>[] = [];
      this.handlers.forEach((f) => promises.push(f(x)));
      return Promise.all(promises);
    }
  }

  // Like a promised handler, but accumulates the result values.
  export class PromisedEventAccumulator<T, T2>
      extends EventHandlerHolder<T,Promise<T2>>
      implements EventHandler<T,Promise<T2>,Promise<T2>> {

    constructor(public accumulator:(a1:T2,a2:T2) => T2) { super(); }

    public handle = (x:T) : Promise<T2> => {
      var promises :Promise<T2>[] = [];
      this.handlers.forEach((f) => promises.push(f(x)));
      return Promise.all<T2>(promises)
          .then((t2s) => {
            return t2s.reduce(this.accumulator);
          });
    }
  }

  // Internal helper class. Holds an object called |thing| of type |T| and a
  // promise for a new result object of type |T2|. The idea is that |T2| is a
  // result of some async function applied to |thing|. This supports the
  // function that gerates the new object to be applied async (later) too.
  //
  // Assumes fulfill/reject are called exclusively and only once.
  class PendingThing<T,T2> {
    public promise :Promise<T2>
    public fulfill :(x:T2) => void;
    public reject :(e:Error) => void;

    constructor(public thing:T) {
      // This holds the T object, and fulfills with a T2 when fulfill is called
      // with T2. The point is we can give back the promise now but fulfill can
      // be called later.
      this.promise = new Promise<T2>((F,R) => {
          this.fulfill = F;
          this.reject = R;
        });
    }
  }

  // Queue up event the handler is set to null. When set to not null handle all
  // the stuff that was queued.
  //
  // CONSIDER: this is a kind of co-promise, and can probably be
  // extended/generalized
  export class Queue<T,T2> {
    // The queue of things to handle.
    private queue_ :PendingThing<T, T2>[] = [];

    // Handler function for things on the queue. When null, things queue up.
    // When non-null, gets called on the thing to handle. When set, called on
    // everything in the queue in FIFO order.
    private handler_ :(x:T) => Promise<T2> = null;

    // We store a handler's promise rejection function and call it when
    // `setHandler`  is called and we had a previously promised handler. We need
    // to do this because the old handler would never fulfill the old promise as
    // it is no longer attached.
    //
    // CONSIDER: How efficient is a new Error? Maybe best to have rejection
    // without an error since the error is not meaningful.
    private rejectFn_ : (e:Error) => void = null;

    // CONSIDER: allow queue to be size-bounded? Reject on too much stuff?
    constructor() {}

    public getLength = () : number => {
      return this.queue_.length;
    }

    // handle or queue the given thing.
    public handle = (x:T) : Promise<T2> => {
      if(this.handler_) {
        return this.handler_(x);
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
        this.handler_(pendingThing.thing).then(pendingThing.fulfill);
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
    public onceHandler = (handler:(x:T) => T2) : Promise<T2> => {
      return new Promise((F,R) => {
        this.setHandler((x:T) : T2 => {
          // Note: we don't call setHandler here because it is responsible for
          // cancelling the last promise if one was made: you only get one promise
          // to handle, so if we called it, we'd reject the promise we are
          // supposed to be fulfilling!
          this.handler_ = null;
          this.rejectFn_ = null;
          F(handler(x));
          return null;
        });
        this.rejectFn_ = R;
      });
    }

    // Make promise for when the next call to handle is made.
    //
    // Note: this sets the Handler to fulfil this promise when there is
    // something to handle.
    public oncePromiseHandler = (handler:(x:T) => Promise<T2>)
        : Promise<T2> => {
      return new Promise((F,R) => {
        this.setHandler((x:T) : T2 => {
          // Note: we don't call setHandler here because it is responsible for
          // cancelling the last promise if one was made: you only get one promise
          // to handle, so if we called it, we'd reject the promise we are
          // supposed to be fulfilling!
          this.handler_ = null;
          this.rejectFn_ = null;
          handler(x).then(F);
          return null;
        });
        this.rejectFn_ = R;
      });
    }

    // Calling setHandler with null pauses handling and queues all objects to be
    // handled.
    //
    // If you have an unfulfilled promise, calling setHandler rejects the old
    // promise.
    public setPromiseHandler = (handler:(x:T) => Promise<T2>) : void => {
      if (this.rejectFn_) {
        this.rejectFn_(new Error('Cancelled by a call to setHandler'));
        this.rejectFn_ = null;
      }
      this.handler_ = handler;
      this.processQueue_();
    }
    public setHandler = (handler:(x:T) => T2) : void => {
      this.setPromiseHandler((x:T) => { return Promise.resolve(handler(x)); });
    }
    public stopHandling = () => {
      this.setPromiseHandler(null);
    }

  }  // class Queue

}  // module Handler
