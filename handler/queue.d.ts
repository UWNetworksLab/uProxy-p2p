/// <reference path='../third_party/promise/promise.d.ts' />
declare module Handler {

  // A stream of events happen async with a stream of functions to handle those
  // events. A function handling an event may set the function to handle future
  // events or event stop handling events and let the event stream queue up.
  // Each event is guarenteed to be handled, and gets a promise for the result.
  class Queue<T,T2> {
    constructor();

    // Clears the queue, and rejects promises for each entry.
    public clear :() => void;

    // Number of things in the queue to be handled.
    public getLength :() => number;

    // Called by code that wants |x| to be handled. Returns a promise for
    // when |x| is handled. Queues |x| until it can be handled.
    public handle :(x:T) => Promise<T2>;

    // The queue stops being handled and all future that |handle| is called on
    // are queued. If |setSyncNextHandler| or |setAsyncNextHandler| has been
    // called, then its return promise is rejected.
    public stopHandling :() => void;

    // Returns true if on of the |set*| functions has been called but
    // |stopHandling| has not. Returns false after |stopHandling| has been
    // called.
    public isHandling :() => boolean;

    // A promise that handles the next element in the queue, or if the queue
    // is empty, the promise resolves the next time `handle` is called (assuming
    // by then the queue isn't stopped or handler changed by then).
    public setSyncNextHandler :(handler:(x:T) => T2) => Promise<T2>;
    // As above, but allows handler itself to be async.
    public setNextHandler :(handler:(x:T) => Promise<T2>)
        => Promise<T2>;

    // The provided function will be called on the next element while the queue
    // is not empty & the handler itself is set (if `stopHandling()` is called
    // while hanlding an entry, then further elements will be queued until a new
    // handler is set.
    public setSyncHandler :(handler:(x:T) => T2) => void;
    // As above, but allows handler to be async function.
    public setHandler :(handler:(x:T) => Promise<T2>) => void;
  }
}
