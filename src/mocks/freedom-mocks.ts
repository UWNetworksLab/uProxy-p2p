/**
 * freedom-mocks.ts
 *
 * This file must be compiled independently of all other typescript in uProxy.
 */

/// <reference path='../../node_modules/freedom-typescript-api/interfaces/promise.d.ts' />

class MockStorage {

  private store_;

  constructor(init_store) {
    this.store_ = init_store;
  }

  public keys = () => {
    return Object.keys(this.store_);
  }

  public get = (key) => {
    var v = this.store_[key];
    console.log('[MockStorage] get ' + key);
    if (v) {
      return Promise.resolve(v);
    }
    return Promise.reject();  // new Error('non-existing key'));
  }

  public set = (key, value) => {
    var prev = this.store_[key];
    this.store_[key] = value;
    console.log('[MockStorage] set ' + key + ' : ' + value);
    return Promise.resolve(prev);
  }

  public remove = (key) => {
    //console.log("\n  public remove(" + key + ").");
    var prev = this.store_[key];
    delete this.store_[key];
    return Promise.resolve(prev);
  }

  public clear = () => {
    this.store_ = {};
    return Promise.resolve();
  }

}  // class MockStorage

class MockChannel {

  public on = (eventTypeString, callback) => {
    return null;
  }

  public emit = (eventTypeString, value) => {
    return null;
  }

}

class MockSocial {
  public on = () => {}
  public emit = () => {}
}

var freedom = new MockChannel();
freedom['storage'] = () => { return new MockStorage({}); };
var mockSocial = () => { return new MockSocial(); };
mockSocial['api'] = 'social';
mockSocial['manifest'] = 'I have no manifest :)';

freedom['SOCIAL-websocket'] = mockSocial;
freedom['SocksToRtc'] = () => { return new MockChannel(); };
freedom['RtcToNet'] = () => { return new MockChannel(); };

var DEBUG = true;

var log = console;
