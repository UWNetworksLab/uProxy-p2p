/**
 * freedom-mocks.ts
 *
 * Mock freedom objects used for uProxy unit tests. The mock classes below
 * implement different freedom interfaces found in freedom/typings/freedom.d.ts.
 * This file must be compiled independently of all other typescript in uProxy.
 */

/// <reference path='../../../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../../third_party/typings/jasmine/jasmine.d.ts' />
/// <reference path='../../../third_party/freedom-typings/storage.d.ts' />


export class MockStorage implements freedom_Storage {

  private store_ :{[key :string] :Object} = {};

  public keys = () => {
    return Promise.resolve(Object.keys(this.store_));
  }

  public get = (key :string) => {
    var v = this.store_[key];
    if (v) {
      return Promise.resolve(v);
    }
    return Promise.reject('non-existing key');
  }

  public set = (key :string, value :Object) => {
    var prev = this.store_[key];
    this.store_[key] = value;
    return Promise.resolve(prev);
  }

  public remove = (key :string) => {
    //console.log("\n  public remove(" + key + ").");
    var prev = this.store_[key];
    delete this.store_[key];
    return Promise.resolve(prev);
  }

  public clear = () => {
    this.store_ = {};
    return Promise.resolve<void>();
  }

}  // class MockStorage

export class MockLoggingController {
  public setDefaultFilter = (destination :number, level :number) => {}
}

export class MockMetrics {
  private data_ :{[name :string] :any} = {};
  public report = (key :string, value :any) => {
    this.data_[key] = value;
    return Promise.resolve();
  }
  public retrieve = () => {
    var obfuscatedData :{[name :string] :string} = {};
    for (var key in this.data_) {
      obfuscatedData[key] = Math.random().toString();
    }
    return Promise.resolve(obfuscatedData);
  }
  public retrieveUnsafe = () => {
    return Promise.resolve(this.data_);
  }
}
