/// <reference path="../../../build/third_party/freedom-typings/freedom-common.d.ts" />

import freedomTypes = require('freedom.types');

// A simple mock implementation of the freedom event handler that lets you cause
// fake events. Useful for mocking out freedom freedom modules that will raise
// events.
class MockFreedomEventHandler implements freedomTypes.EventHandler {
  private onHandlerTable_ : {[t:string] : Function[]} = {};
  private onceHandlerTable_ : {[t:string] : Function[]} = {};

  private static removeFromArray_<T>(x:T, a:T[]) {
    var index = a.indexOf(x);
    if (index > -1) { a.splice(index, 1); }
  }

  constructor(public eventTypes_:string[]) {
    eventTypes_.map((t) => {
      this.onHandlerTable_[t] = [];
      this.onceHandlerTable_[t] = [];
    });
  }

  public on(t:string,f:Function) {
    this.onHandlerTable_[t].push(f);
  }
  public once(t:string,f:Function) {
    this.onceHandlerTable_[t].push(f);
  }
  // off removes the event from both |onHandlerTable_| and |onceHandlerTable_|.
  public off(t:string,f:Function) {
    MockFreedomEventHandler.removeFromArray_(f,this.onHandlerTable_[t]);
    MockFreedomEventHandler.removeFromArray_(f,this.onceHandlerTable_[t]);
  }

  // Note: this is not part of the freedom interface.
  public fakeAnEvent(t:string, x:Object) {
    this.onHandlerTable_[t].map((f) => { f(x); });
    this.onceHandlerTable_[t].map((f) => { f(x); });
    this.onceHandlerTable_[t] = [];
  }
}

export = MockFreedomEventHandler;
