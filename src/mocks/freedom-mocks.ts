/**
 * freedom-mocks.ts
 *
 * This file must be compiled independently of all other typescript in uProxy.
 */

/// <reference path='../third_party/typings/es6-promise/es6-promise.d.ts' />


class MockCore {

  public createChannel = () => {
    return Promise.resolve({ identifier: 'unused' });
  }

  public bindChannel = (id:string) => {
    return Promise.resolve(null);
  }

  public getId = () => { return ['useless']; }

}  // class MockCore

class MockCorePeerConnection {

  public createOffer = () => {
    var mockDesc = {
      sdp: 'a=fingerprint:sha-256 00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:' +
          'EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF '
    };
    return Promise.resolve(mockDesc);
  }

  public setup = () => {
    console.log('[MockCorePeerConnection] setup');
  }

}  // class MockPeerConnection

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
    return Promise.reject('non-existing key');
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

class MockLog {
}

var freedom = new MockChannel();
freedom['storage'] = () => { return new MockStorage({}); };
var mockSocial = () => { return new MockSocial(); };
mockSocial['api'] = 'social';
mockSocial['manifest'] = 'I have no manifest :)';

freedom['core'] = () => { return new MockCore(); };
freedom['core.log'] = () => { return new MockLog(); };
freedom['core.peerconnection'] = () => { return new MockCorePeerConnection(); };
freedom['SOCIAL-websocket'] = mockSocial;
// freedom['SocksToRtc'] = () => { return new MockChannel(); };
// freedom['RtcToNet'] = () => { return new MockChannel(); };

var DEBUG = true;

var log = console;
