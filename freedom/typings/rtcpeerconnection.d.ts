// Typescript file for core.rtcpeerconnection in:
// https://github.com/freedomjs/freedom/blob/master/interface/core.rtcpeerconnection.json

/// <reference path="../../third_party/typings/es6-promise/es6-promise.d.ts" />
/// <reference path='freedom.d.ts' />

declare module freedom_RTCPeerConnection {
  interface RTCIceServer {
    urls :string[];
    username ?:string;
    credential ?:string;
  }

  interface RTCConfiguration {
    iceServers :RTCIceServer[];
    iceTransports ?:string;
    peerIdentity ?:string;
  }

  interface RTCOfferOptions {
    offerToReceiveVideo ?:number;
    offerToReceiveAudio ?:number;
    voiceActivityDetection ?:boolean;
    iceRestart ?:boolean;
  }

  interface RTCSessionDescription {
    type :string;
    sdp :string;
  }

  interface RTCIceCandidate {
    candidate :string;
    sdpMid ?:string;
    sdpMLineIndex ?:number;
  }

  interface OnIceCandidateEvent {
    candidate :RTCIceCandidate
  }

  interface RTCDataChannelInit {
    ordered ?:boolean;
    maxPacketLifeTime ?:number;
    maxRetransmits ?:number;
    protocol ?:string;
    negotiated ?:boolean;
    id ?:number;
  }

  class RTCPeerConnection {
    // Construct a new peer connection.
    constructor(config:RTCConfiguration);

    createOffer(options?:RTCOfferOptions) : Promise<RTCSessionDescription>;
    createAnswer() : Promise<RTCSessionDescription>;

    setLocalDescription(desc:RTCSessionDescription) : Promise<void>;
    getLocalDescription() : Promise<RTCSessionDescription>;
    setRemoteDescription(desc:RTCSessionDescription) : Promise<void>;
    getRemoteDescription() : Promise<RTCSessionDescription>;

    getSignalingState() : Promise<string>;

    updateIce(configuration:RTCConfiguration) : Promise<void>;

    addIceCandidate(candidate:RTCIceCandidate) : Promise<void>;

    getIceGatheringState() : Promise<string>;
    getIceConnectionState() : Promise<string>;

    getConfiguration() : Promise<RTCConfiguration>;

    getLocalStreams() : Promise<string[]>;
    getRemoteStreams() : Promise<string[]>;
    getStreamById(id:string) : Promise<string>;
    addStream(ref:string) : Promise<void>;
    removeStream(ref:string) : Promise<void>;

    close() : Promise<void>;

    createDataChannel(label:string, init:RTCDataChannelInit) : Promise<string>;
    on(t:'ondatachannel', f:(d:{channel:string}) => void) : void;

    getStats(selector?:string) : Promise<any>;

    on(t:string, f:Function) : void;
    on(t:'onnegotiationneeded', f:() => void) : void;
    on(t:'onicecandidate', f:(d:OnIceCandidateEvent) => void) : void;
    on(t:'onsignalingstatechange', f:() => void) : void;
    on(t:'onaddstream', f:(d:{stream:number}) => void) : void;
    on(t:'onremovestream', f:(d:{stream:number}) => void) : void;
    on(t:'oniceconnectionstatechange', f:() => void) : void;
  }
}
