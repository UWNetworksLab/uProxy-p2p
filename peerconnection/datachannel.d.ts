/// <reference path="../handler/queue.ts" />
/// <reference path="../third_party/typings/es6-promise/es6-promise.d.ts" />
/// <reference path="../third_party/typings/webrtc/RTCPeerConnection.d.ts" />

declare module WebRtc {

  interface Data {
    // Only one of these should be specified.
    // TODO: use union type once it is supported in TypeScript.
    str    ?:string;
    buffer ?:Uint8Array;
  }

  class DataChannel {
    constructor(rtcDataChannel: RTCDataChannel);

    // Guarenteed to be invarient for the life of the data channel.
    public getLabel :() => string;
    public getState :() => string;  // 'connecting', 'open', 'closed'

    // Promise for when the data channel has been openned.
    public onceOpened :Promise<void>;

    // Promise for when the data channel has been closed (only fulfilled after
    // the data channel has been openned).
    // NOTE: There exists a bug in Chrome prior to version 37 which prevents
    //       this from fulfilling on the remote peer.
    public onceClosed :Promise<void>;

    // Data from the peer. No data will be added to the queue after |onceClosed|
    // is fulfilled.
    public fromPeerDataQueue :Handler.Queue<Data, void>;

    // Send data; promise returns when all the data has been passed on to the
    // undertlying network layer for ending.
    public send :(data:Data) => Promise<void>;

    // Closes this data channel.
    // A channel cannot be re-opened once this has been called.
    public close :() => void;
  }
}
