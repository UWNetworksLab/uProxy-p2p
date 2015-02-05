/// <reference path='../../../build/third_party/freedom-typings/freedom-common.d.ts' />

import freedomTypes = require('freedom.types');

// A simple mock implementation of the freedom event handler that lets you cause
// fake events. Useful for mocking out freedom freedom modules that will raise
// events.
class MockFreedomEventHandler implements freedomTypes.EventHandler {
  private onHandlerTable_ : {[eventname:string] : Function[]} = {};
  private onceHandlerTable_ : {[eventname:string] : Function[]} = {};

  private static removeFromArray_<T>(x:T, a:T[]) : void {
    var index = a.indexOf(x);
    if (index > -1) { a.splice(index, 1); }
  }

  constructor(private eventTypes_:string[]) {
    eventTypes_.map((eventname) => {
      this.onHandlerTable_[eventname] = [];
      this.onceHandlerTable_[eventname] = [];
    });
  }

  public on(eventname:string, callback:Function) : void {
    this.onHandlerTable_[eventname].push(callback);
  }

  public once(eventname:string, callback:Function) {
    this.onceHandlerTable_[eventname].push(callback);
  }

  // Off removes the event from both |onHandlerTable_| and |onceHandlerTable_|.
  // See: https://github.com/freedomjs/freedom/wiki/freedom.js-structure:-Consumer-Interface
  public off(eventname:string, callback:Function) : void {
    MockFreedomEventHandler.removeFromArray_(callback,
        this.onHandlerTable_[eventname]);
    MockFreedomEventHandler.removeFromArray_(callback,
        this.onceHandlerTable_[eventname]);
  }

  // Note: this is not part of the freedom interface.
  public fakeAnEvent(eventname:string, eventArgument?:Object) : void {
    this.onHandlerTable_[eventname].map(
        (callback) => { callback(eventArgument); });
    this.onceHandlerTable_[eventname].map(
        (callback) => { callback(eventArgument); });
    this.onceHandlerTable_[eventname] = [];
  }
}

export = MockFreedomEventHandler;
