/// <reference path='../../../../third_party/typings/index.d.ts' />

// A Handler abstraction for events. This abstraction allows all event handlers
// to produce an output that can be passed back to the code that causes the
// event to be handled. This can be used for summarization/retriggering of
// compound events. e.g. to revieve and accumulate buffers until the amount of
// data is above a certain size. This is intended for use with Hanlder Queues
// (See |queue.ts|).

export interface FunctionOf1Arg<T,T2> { (x:T) : T2; }

// CONSIDER: allow async functions, it would use soemghing like this:
// export interface PromiseFunctionOf1Arg<T,T2> { (x:T) : Promise<T2>; }

// Abstract interface for an event handler, where each handling function
// results in a T2 object, and by handling all events, an object of type T3 is
// produced.
export interface EventHandler<T,T2,T3> {
  add       :(f:(x:T) => T2) => void;
  remove    :(f:(x:T) => T2) => void;
  removeAll :() => void;
  handle    :(x:T) => T3;
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
  public removeAll = () : void => {
    this.handlers = [];
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

// Event handler for when the events return a promise, and when you handle
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
