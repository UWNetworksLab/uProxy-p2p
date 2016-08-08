/// <reference path='../../../../../third_party/typings/index.d.ts' />

import RTCConfiguration = freedom.RTCPeerConnection.RTCConfiguration;
import RTCDataChannelInit = freedom.RTCPeerConnection.RTCDataChannelInit;
import RTCIceCandidate = freedom.RTCPeerConnection.RTCIceCandidate;
import RTCOfferOptions = freedom.RTCPeerConnection.RTCOfferOptions;
import RTCPeerConnection = freedom.RTCPeerConnection.RTCPeerConnection;
import RTCSessionDescription = freedom.RTCPeerConnection.RTCSessionDescription;

import MockEventHandler = require('./mock-eventhandler');

class MockFreedomRtcPeerConnection extends MockEventHandler
    implements RTCPeerConnection {
  constructor() {
    super(['ondatachannel', 'onnegotiationneeded', 'onicecandidate',
     'onsignalingstatechange', 'onaddstream', 'onremovestream',
     'oniceconnectionstatechange']);
  }

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
