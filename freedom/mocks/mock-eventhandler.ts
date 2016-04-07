/// <reference path='../../../../third_party/typings/browser.d.ts' />

// A simple mock implementation of the freedom event handler that lets you cause
// fake events. Useful for mocking out freedom freedom modules that will raise
// events.
class MockFreedomEventHandler implements freedom.EventHandler {
  private onHandlerTable_ : {[eventName:string] : Function[]} = {};
  private onceHandlerTable_ : {[eventName:string] : Function[]} = {};

  private static removeFromArray_<T>(x:T, a:T[]) : void {
    var index = a.indexOf(x);
    if (index > -1) { a.splice(index, 1); }
  }

  constructor(eventTypes_:string[]) {
    eventTypes_.map((eventName) => {
      this.onHandlerTable_[eventName] = [];
      this.onceHandlerTable_[eventName] = [];
    });
  }

  public on(eventName:string, callback:Function) : void {
    this.onHandlerTable_[eventName].push(callback);
  }

  public once(eventName:string, callback:Function) {
    this.onceHandlerTable_[eventName].push(callback);
  }

  // Off removes the event from both |onHandlerTable_| and |onceHandlerTable_|.
  // See: https://github.com/freedomjs/freedom/wiki/freedom.js-structure:-Consumer-Interface
  public off(eventName:string, callback:Function) : void {
    MockFreedomEventHandler.removeFromArray_(callback,
        this.onHandlerTable_[eventName]);
    MockFreedomEventHandler.removeFromArray_(callback,
        this.onceHandlerTable_[eventName]);
  }

  // Note: this is not part of the freedom interface.
  public handleEvent(eventName:string, eventArgument?:Object) : void {
    this.onHandlerTable_[eventName].map(
        (callback) => { callback(eventArgument); });
    this.onceHandlerTable_[eventName].map(
        (callback) => { callback(eventArgument); });
    this.onceHandlerTable_[eventName] = [];
  }
}

export = MockFreedomEventHandler;
