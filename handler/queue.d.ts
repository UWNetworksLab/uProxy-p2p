/// <reference path='../third_party/promise/promise.d.ts' />
declare module Handler {
  // Queues events/data while a handler is not set. Allows events to async
  // call handle, and separately asyncronously for us to make promises to
  // handle the next using onceHandleNext.
  //
  // CONSIDER: Break into a inputNotifyQueue, and an exitNotifyQueue.
  class Queue<T,T2> {
    constructor();

    // Clears the queue, and rejects promises for each entry.
    public clear :() => void;

    // Number of things in the queue to be handled.
    public getLength :() => number;

    // Called by code that wants `x` to be handled. Returns a promise for
    // when `x` is handled.
    public handle :(x:T) => Promise<T2>;

    // A promise that handles the next element in the queue, or if the queue
    // is empty, promise resolves the next time `handle` is called (assuming
    // by then that neither `onceHandler` or `setHandler` is called as they
    // will reject the current onceHandler promise and make a new promise).
    public onceHandler :(handler:(x:T) => T2) => Promise<T2>;
    // As above, but allows handler itself to be async.
    public oncePromiseFnHandler :(handler:(x:T) => Promise<T2>)
        => Promise<T2>;

    // If set to null, things to handle are queued. If set to a function,
    // then that function will be called on the next element while the queue
    // is not empty & the handler itself is set (if `setHandler(null)` is
    // called while hanlding an entry, then further elements will be queued.
    public setHandler :(handler:(x:T) => T2) => void;
    // As above, but allows handler to be async function.
    public setPromiseHandler :(handler:(x:T) => Promise<T2>) => void;
  }
}
