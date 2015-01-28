/// <reference path="datachannel.d.ts" />

/// <reference path='../freedom/typings/rtcpeerconnection.d.ts' />
/// <reference path="../third_party/typings/es6-promise/es6-promise.d.ts" />
/// <reference path="../third_party/typings/webcrypto/WebCrypto.d.ts" />

/// <reference path="../handler/queue.d.ts" />

declare module WebRtc {

  enum SignalType {
    OFFER, ANSWER, CANDIDATE, NO_MORE_CANDIDATES
  }

  interface SignallingMessage {
    type          :SignalType
    candidate     ?:freedom_RTCPeerConnection.RTCIceCandidate;
    description   ?:freedom_RTCPeerConnection.RTCSessionDescription;
  }

  // Possible candidate types, e.g. RELAY if a host is only accessible
  // via a TURN server. The values are taken from this file; as the comment
  // suggests, not all values may be found in practice:
  //   https://code.google.com/p/chromium/codesearch#chromium/src/third_party/libjingle/source/talk/p2p/base/port.cc

  interface Endpoint {
    address:string;
    port:number;
  }

  enum State {
    WAITING,      // Can move to CONNECTING.
    CONNECTING,   // Can move to CONNECTED or DISCONNECTED.
    CONNECTED,    // Can move to DISCONNECTED.
    DISCONNECTED  // End-state, cannot change.
  }

  interface PeerConnectionInterface<TSignallingMessage> {
    // The state of this peer connection.
    pcState :State;

    // All open data channels.
    // NOTE: There exists a bug in Chrome prior to version 37 which causes
    //       entries in this object to continue to exist even after
    //       the remote peer has closed a data channel.
    dataChannels     :{[channelLabel:string] : DataChannel};

    // The |onceConnecting| promise is fulfilled when |pcState === CONNECTING|.
    // i.e. when either |handleSignalMessage| is called with an offer message,
    // or when |negotiateConnection| is called. The promise is never be rejected
    // and is guarenteed to fulfilled before |onceConnected|.
    onceConnecting  :Promise<void>;
    // The |onceConnected| promise is fulfilled when pcState === CONNECTED
    onceConnected :Promise<void>;
    // The |onceDisconnected| promise is fulfilled when pcState === DISCONNECTED
    onceDisconnected :Promise<void>;

    // Try to connect to the peer. Will change state from |WAITING| to
    // |CONNECTING|. If there was an error, promise is rejected. Otherwise
    // returned promise === |onceConnected|.
    negotiateConnection :() => Promise<void>;

    // A peer connection can either open a data channel to the peer (will
    // change from |WAITING| state to |CONNECTING|)
    openDataChannel :(channelLabel: string,
        options?: freedom_RTCPeerConnection.RTCDataChannelInit) =>
        Promise<DataChannel>;
    // Or handle data channels opened by the peer (these events will )
    peerOpenedChannelQueue :Handler.Queue<DataChannel, void>;

    // The |handleSignalMessage| function should be called with signalling
    // messages from the remote peer.
    handleSignalMessage :(signal:TSignallingMessage) => void;
    // The underlying handler that holds/handles signals intended to go to the
    // remote peer. A handler should be set that sends messages to the remote
    // peer.
    signalForPeerQueue :Handler.Queue<TSignallingMessage, void>;

    // Closing the peer connection will close all associated data channels
    // and set |pcState| to |DISCONNECTED| (and hence fulfills
    // |onceDisconnected|)
    close: () => void;

    // Helpful for debugging
    toString: () => string;
    peerName :string;
  }

  class PeerConnection implements PeerConnectionInterface<SignallingMessage> {

    public static fromRtcPeerConnection(
        pc:freedom_RTCPeerConnection.RTCPeerConnection) : PeerConnection;

    // Name is used in logging output and is useful for debugging when
    // there's >1 peerconnection in the app.
    public static fromRtcPeerConnectionWithName(
        pc:freedom_RTCPeerConnection.RTCPeerConnection,
        name:string) : PeerConnection;

    // Private constructor.
    constructor(
        pc:freedom_RTCPeerConnection.RTCPeerConnection,
        name:string);

    public pcState :State;
    public dataChannels     :{[channelLabel:string] : DataChannel};

    public onceConnecting  :Promise<void>;
    public onceConnected :Promise<void>;
    public onceDisconnected :Promise<void>;

    public negotiateConnection :() => Promise<void>;

    public openDataChannel :(channelLabel: string,
                             options?: freedom_RTCPeerConnection.RTCDataChannelInit) => Promise<DataChannel>;

    public peerOpenedChannelQueue :Handler.Queue<DataChannel, void>;

    public handleSignalMessage :(signal:SignallingMessage) => void;
    public signalForPeerQueue :Handler.Queue<SignallingMessage, void>;

    public close: () => void;

    public toString: () => string;
    public peerName :string;
  }

  // Generic helper functions useful for debugging.
  var stringHash :(s: string, bytes: number) => string;
}
