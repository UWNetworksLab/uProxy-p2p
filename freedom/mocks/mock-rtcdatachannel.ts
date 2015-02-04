/// <reference path="../../../third_party/typings/es6-promise/es6-promise.d.ts" />
/// <reference path="../typings/freedom-common.d.ts" />
/// <reference path="../typings/rtcpeerconnection.d.ts" />
/// <reference path="../typings/rtcdatachannel.d.ts" />

import RTCConfiguration = freedom_RTCPeerConnection.RTCConfiguration;
import RTCDataChannelInit = freedom_RTCPeerConnection.RTCDataChannelInit;
import RTCIceCandidate = freedom_RTCPeerConnection.RTCIceCandidate;
import RTCOfferOptions = freedom_RTCPeerConnection.RTCOfferOptions;
import RTCPeerConnection = freedom_RTCPeerConnection.RTCPeerConnection;
import RTCSessionDescription = freedom_RTCPeerConnection.RTCSessionDescription;
import RTCDataChannel = freedom_RTCDataChannel.RTCDataChannel;

import MockEventHandler = require('./mock-eventhandler');

class MockFreedomRtcDataChannel implements RTCDataChannel {
  public eventHandler = new MockEventHandler(
    ['onopen', 'onerror', 'onclose', 'onmessage']);

  // Construct a new skeleton peer connection.
  constructor() {}

  public on(t:string, f:Function) { this.eventHandler.on(t,f); }
  public once(t:string, f:Function) { this.eventHandler.once(t,f); }

  public getLabel() : Promise<string> { return Promise.resolve(null); }
  public getOrdered() : Promise<boolean> { return Promise.resolve(null); }
  public getMaxPacketLifeTime() : Promise<number> { return Promise.resolve(null); }
  public getMaxRetransmits() : Promise<number> { return Promise.resolve(null); }
  public getProtocol() : Promise<string> { return Promise.resolve(null); }
  public gotiated() : Promise<boolean> { return Promise.resolve(null); }
  public getId() : Promise<number> { return Promise.resolve(null); }
  public getNegotiated() : Promise<boolean>  { return Promise.resolve(null); }
  public getReadyState() : Promise<string> { return Promise.resolve(null); }
  public getBufferedAmount() : Promise<number> { return Promise.resolve(null); }

  public close() : Promise<void> { return Promise.resolve<void>(); }
  public getBinaryType() : Promise<string> { return Promise.resolve(null); }
  public setBinaryType(type:string) : Promise<void> { return Promise.resolve<void>(); }
  public send(message:string) : Promise<void> { return Promise.resolve<void>(); }
  public sendBuffer(message:ArrayBuffer) : Promise<void> { return Promise.resolve<void>(); }

}

export = MockFreedomRtcDataChannel;
