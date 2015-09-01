/// <reference path='../../../../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../../../third_party/typings/freedom/freedom.d.ts' />

import RTCConfiguration = freedom.RTCPeerConnection.RTCConfiguration;
import RTCDataChannelInit = freedom.RTCPeerConnection.RTCDataChannelInit;
import RTCIceCandidate = freedom.RTCPeerConnection.RTCIceCandidate;
import RTCOfferOptions = freedom.RTCPeerConnection.RTCOfferOptions;
import RTCPeerConnection = freedom.RTCPeerConnection.RTCPeerConnection;
import RTCSessionDescription = freedom.RTCPeerConnection.RTCSessionDescription;
import RTCDataChannel = freedom.RTCDataChannel.RTCDataChannel;

import MockEventHandler = require('./mock-eventhandler');

function makeMockSend<T>() : freedom.Method1<T,void> {
  var f : any = (x:T) => {
    return Promise.resolve<void>();
  };
  f.reckless = (x:T) => {};
  return f;
}

class MockFreedomRtcDataChannel extends MockEventHandler
    implements RTCDataChannel {
  constructor() {
    super(['onopen', 'onerror', 'onclose', 'onmessage']);
  }

  public getLabel() : Promise<string> { return Promise.resolve(null); }

  public getOrdered() : Promise<boolean> { return Promise.resolve(null); }

  public getMaxPacketLifeTime() : Promise<number> {
    return Promise.resolve(null);
  }

  public getMaxRetransmits() : Promise<number> { return Promise.resolve(null); }

  public getProtocol() : Promise<string> { return Promise.resolve(null); }

  public getNegotiated() : Promise<boolean>  { return Promise.resolve(null); }

  public getId() : Promise<number> { return Promise.resolve(null); }

  public getReadyState() : Promise<string> { return Promise.resolve(null); }

  public getBufferedAmount() : Promise<number> { return Promise.resolve(null); }

  public close() : Promise<void> { return Promise.resolve<void>(); }

  public getBinaryType() : Promise<string> { return Promise.resolve(null); }

  public setBinaryType(type:string) : Promise<void> {
    return Promise.resolve<void>();
  }

  public send = makeMockSend<string>()

  public sendBuffer = makeMockSend<ArrayBuffer>()
}

export = MockFreedomRtcDataChannel;
