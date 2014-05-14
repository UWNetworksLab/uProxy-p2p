/**
 * freedom-mocks.ts
 *
 * This file must be compiled independently of all other typescript in uProxy.
 */

class MockStorage {

  private store_;

  constructor(init_store) {
    this.store_ = init_store;
  }

  // TODO: Update to reflect promises when freedom does, too.
  public get = (key) => {
    var v = this.store_[key];
    //console.log("\n  public get(" + key + "): " + this.store_[key]);
    return { done: (callback) => { if(callback) callback(v); } };
  }

  public set = (key, value) => {
    this.store_[key] = value;
    //console.log("\n  public set(" + key + "): " + this.store_[key]);
    return { done: (callback) => { if(callback) callback(); } };
  }

  public remove = (key) => {
    //console.log("\n  public remove(" + key + ").");
    delete this.store_[key];
    return { done: (callback) => { if(callback) callback(); } };
  }

  public clear = () => {
    this.store_ = {};
    //console.log("\n  public clear.");
    return { done: (callback) => { if(callback) callback(); } };
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
