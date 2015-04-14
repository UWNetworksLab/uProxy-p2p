/**
 * freedom-mocks.ts
 *
 * Mock freedom objects used for uProxy unit tests. The mock classes below
 * implement different freedom interfaces found in freedom/typings/freedom.d.ts.
 * This file must be compiled independently of all other typescript in uProxy.
 */

/// <reference path='../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../../third_party/typings/jasmine/jasmine.d.ts' />
/// <reference path='../freedom/typings/storage.d.ts' />


class MockCore {

  public createChannel = () => {
    return Promise.resolve({ identifier: 'unused' });
  }

  public bindChannel = (id:string) => {
    return Promise.resolve(null);
  }

  public getId = () => { return ['useless']; }

  public getLogger = (tag) => {
    var logger = jasmine.createSpyObj('logger-'+tag, ['log', 'info', 'error']);
    freedom['loggers'][tag] = logger;
    return Promise.resolve(logger);
  }
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

class MockStorage implements freedom_Storage {

  private store_;

  constructor(init_store) {
    this.store_ = init_store;
  }

  public keys = () => {
    return Promise.resolve(Object.keys(this.store_));
  }

  public get = (key) => {
    var v = this.store_[key];
    if (v) {
      return Promise.resolve(v);
    }
    return Promise.reject('non-existing key');
  }

  public set = (key, value) => {
    var prev = this.store_[key];
    this.store_[key] = value;
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
    return Promise.resolve<void>();
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

class MockLoggingProvider {
  public setConsoleFilter = (filter:string) : void => {}
  public setBufferedLogFilter = (filter:string) : void => {}
}  // class MockLoggingProvider

var freedom = () => {
  return new MockChannel();
}
freedom['storage'] = () => { return new MockStorage({}); };
var mockSocial = () => { return new MockSocial(); };
mockSocial['api'] = 'social';
mockSocial['manifest'] = 'I have no manifest :)';

freedom['loggers'] = {};
freedom['core'] = () => { return new MockCore(); };
freedom['loggingprovider'] = () => { return new MockLoggingProvider(); };
freedom['core.rtcpeerconnection'] = () => { return new MockCorePeerConnection(); };
freedom['SOCIAL-websocket'] = mockSocial;

var DEBUG = true;

var log = console;
