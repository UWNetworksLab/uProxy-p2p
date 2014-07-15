/// <reference path="../third_party/typings/es6-promise/es6-promise.d.ts" />

// Event Handler tools.
module Handler {

  export interface FunctionOf1Arg<T,T2> { (x:T) : T2; }
  export interface PromiseFunctionOf1Arg<T,T2> { (x:T) : Promise<T2>; }

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
}  // module Handler
