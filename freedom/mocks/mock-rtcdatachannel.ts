/// <reference path='../../../../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../../../third_party/freedom-typings/freedom-common.d.ts' />
/// <reference path='../../../../third_party/freedom-typings/rtcpeerconnection.d.ts' />
/// <reference path='../../../../third_party/freedom-typings/rtcdatachannel.d.ts' />

import RTCConfiguration = freedom_RTCPeerConnection.RTCConfiguration;
import RTCDataChannelInit = freedom_RTCPeerConnection.RTCDataChannelInit;
import RTCIceCandidate = freedom_RTCPeerConnection.RTCIceCandidate;
import RTCOfferOptions = freedom_RTCPeerConnection.RTCOfferOptions;
import RTCPeerConnection = freedom_RTCPeerConnection.RTCPeerConnection;
import RTCSessionDescription = freedom_RTCPeerConnection.RTCSessionDescription;
import RTCDataChannel = freedom_RTCDataChannel.RTCDataChannel;

import MockEventHandler = require('./mock-eventhandler');

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

  public send(message:string) : Promise<void> {
    return Promise.resolve<void>();
  }

  public sendBuffer(message:ArrayBuffer) : Promise<void> {
    return Promise.resolve<void>();
  }

}

export = MockFreedomRtcDataChannel;
