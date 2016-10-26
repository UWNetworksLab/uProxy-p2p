import RTCConfiguration = freedom.RTCPeerConnection.RTCConfiguration;
import RTCDataChannelInit = freedom.RTCPeerConnection.RTCDataChannelInit;
import RTCIceCandidate = freedom.RTCPeerConnection.RTCIceCandidate;
import RTCOfferOptions = freedom.RTCPeerConnection.RTCOfferOptions;
import RTCPeerConnection = freedom.RTCPeerConnection.RTCPeerConnection;
import RTCSessionDescription = freedom.RTCPeerConnection.RTCSessionDescription;

import MockEventHandler from './mock-eventhandler';

export default class MockFreedomRtcPeerConnection extends MockEventHandler
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
    return Promise.resolve();
  }

  public getLocalDescription() : Promise<RTCSessionDescription> {
    return Promise.resolve(null);
  }

  public setRemoteDescription(desc:RTCSessionDescription) : Promise<void> {
    return Promise.resolve();
  }

  public getRemoteDescription() : Promise<RTCSessionDescription> {
    return Promise.resolve(null);
  }

  public getSignalingState() : Promise<string> {
    return Promise.resolve(null);
  }

  public updateIce(configuration:RTCConfiguration) : Promise<void> {
    return Promise.resolve();
  }

  public addIceCandidate(candidate:RTCIceCandidate) : Promise<void> {
    return Promise.resolve();
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
    return Promise.resolve();
  }

  public removeStream(ref:string) : Promise<void> {
   return Promise.resolve();
  }

  public close() : Promise<void> {
    return Promise.resolve();
  }

  public createDataChannel(label:string, init:RTCDataChannelInit)
      : Promise<string> {
    return Promise.resolve(null);
  }

  public getStats(selector?:string) : Promise<any> {
    return Promise.resolve(null);
  }

}
