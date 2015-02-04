/// <reference path="../../../third_party/typings/es6-promise/es6-promise.d.ts" />
/// <reference path="../typings/freedom-common.d.ts" />
/// <reference path="../typings/rtcpeerconnection.d.ts" />

import RTCConfiguration = freedom_RTCPeerConnection.RTCConfiguration;
import RTCDataChannelInit = freedom_RTCPeerConnection.RTCDataChannelInit;
import RTCIceCandidate = freedom_RTCPeerConnection.RTCIceCandidate;
import RTCOfferOptions = freedom_RTCPeerConnection.RTCOfferOptions;
import RTCPeerConnection = freedom_RTCPeerConnection.RTCPeerConnection;
import RTCSessionDescription = freedom_RTCPeerConnection.RTCSessionDescription;

import MockEventHandler = require('./mock-eventhandler');

class MockFreedomRtcPeerConnection implements RTCPeerConnection {
  public eventHandler = new MockEventHandler(
    ['ondatachannel', 'onnegotiationneeded', 'onicecandidate',
     'onsignalingstatechange', 'onaddstream', 'onremovestream',
     'oniceconnectionstatechange']);

  // Construct a new skeleton peer connection.
  constructor() {}

  public on(t:string, f:Function) { this.eventHandler.on(t,f); }
  public once(t:string, f:Function) { this.eventHandler.once(t,f); }

  public createOffer(options?:RTCOfferOptions) : Promise<RTCSessionDescription> {
    return Promise.resolve(null);
  }
  public createAnswer() : Promise<RTCSessionDescription> {
    return Promise.resolve(null);
  }

  public setLocalDescription(desc:RTCSessionDescription) : Promise<void> {
    return Promise.resolve<void>();
  }
  public getLocalDescription() : Promise<RTCSessionDescription> {
    return Promise.resolve(null);
  }
  public setRemoteDescription(desc:RTCSessionDescription) : Promise<void> {
    return Promise.resolve<void>();
  }
  public getRemoteDescription() : Promise<RTCSessionDescription> {
    return Promise.resolve(null);
  }

  public getSignalingState() : Promise<string> {
    return Promise.resolve(null);
  }

  public updateIce(configuration:RTCConfiguration) : Promise<void> {
    return Promise.resolve<void>();
  }

  public addIceCandidate(candidate:RTCIceCandidate) : Promise<void> {
    return Promise.resolve<void>();
  }

  public getIceGatheringState() : Promise<string> {
    return Promise.resolve(null);
  }
  public getIceConnectionState() : Promise<string> {
    return Promise.resolve(null);
  }

  public getConfiguration() : Promise<RTCConfiguration> {
    return Promise.resolve(null);
  }

  public getLocalStreams() : Promise<string[]> {
    return Promise.resolve(null);
  }
  public getRemoteStreams() : Promise<string[]> {
    return Promise.resolve(null);
  }
  public getStreamById(id:string) : Promise<string> {
    return Promise.resolve(null);
  }
  public addStream(ref:string) : Promise<void> {
    return Promise.resolve<void>();
  }
  public removeStream(ref:string) : Promise<void> {
    return Promise.resolve<void>();
  }

  public close() : Promise<void> {
    return Promise.resolve<void>();
  }

  public createDataChannel(label:string, init:RTCDataChannelInit)
      : Promise<string> {
    return Promise.resolve(null);
  }

  public getStats(selector?:string) : Promise<any> {
    return Promise.resolve(null);
  }

}

export = MockFreedomRtcPeerConnection;
