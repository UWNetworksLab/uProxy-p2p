/// <reference path="../../third_party/typings/es6-promise/es6-promise.d.ts" />
/// <reference path='../freedom/typings/rtcpeerconnection.d.ts' />

import DataChannelInterfaces = require('datachannel.i');
import ArrayBuffers = require('../arraybuffers/arraybuffers');
import Logging = require('../logging/logging');
import Random = require('../crypto/random');
import Handler = require('../handler/queue');

import DataChannel = DataChannelInterfaces.Channel;

export enum State {
  WAITING,      // Can move to CONNECTING.
  CONNECTING,   // Can move to CONNECTED or DISCONNECTED.
  CONNECTED,    // Can move to DISCONNECTED.
  DISCONNECTED  // End-state, cannot change.
}

export interface PeerConnection<TSignallingMessage> {
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
  peerOpenedChannelQueue :Handler.QueueHandler<DataChannel, void>;

  // The |handleSignalMessage| function should be called with signalling
  // messages from the remote peer.
  handleSignalMessage :(signal:TSignallingMessage) => void;
  // The underlying handler that holds/handles signals intended to go to the
  // remote peer. A handler should be set that sends messages to the remote
  // peer.
  signalForPeerQueue :Handler.QueueHandler<TSignallingMessage, void>;

  // Closing the peer connection will close all associated data channels
  // and set |pcState| to |DISCONNECTED| (and hence fulfills
  // |onceDisconnected|)
  close: () => void;

  // Helpful for debugging
  toString: () => string;
  peerName :string;
}

// DataPeer - a class that wraps peer connections and data channels.
//
// This class assumes WebRTC is available; this is provided by freedom.js.

export interface PeerConnectionConfig {
  webrtcPcConfig         :freedom_RTCPeerConnection.RTCConfiguration;
  peerName               ?:string;   // For debugging
  initiateConnection     ?:boolean;  // defaults to false
}

export enum SignalType {
  OFFER, ANSWER, CANDIDATE, NO_MORE_CANDIDATES
}

export interface SignallingMessage {
  // CONSIDER: use string-enum when typescript supports it.
  type          :SignalType
  // The |candidate| parameter is set iff type === CANDIDATE
  candidate     ?:freedom_RTCPeerConnection.RTCIceCandidate;
  // The |description| parameter is set iff type === OFFER or
  // type === ANSWER
  description   ?:freedom_RTCPeerConnection.RTCSessionDescription;
}

// Possible candidate types, e.g. RELAY if a host is only accessible
// via a TURN server. The values are taken from this file; as the comment
// suggests, not all values may be found in practice:
//   https://code.google.com/p/chromium/codesearch#chromium/src/third_party/libjingle/source/talk/p2p/base/port.cc

// This should match the uproxy-networking/network-typings/communications.d.ts
// type with the same name (Net.Endpoint).
export interface Endpoint {
  address:string; // IPv4, IPv6, or domain name.
  port:number;
}
