/// <reference path='../../../../third_party/typings/browser.d.ts' />

// This enum describes a simple signal message protocol for establishing P2P
// connections. TODO: rename to more accurately describe the intended
// abstraction: namely: INIT, DATA, END
export enum Type {
  OFFER,              // INIT new connection
  ANSWER,             // ACK of new connection
  // Possible candidate types, e.g. RELAY if a host is only accessible
  // via a TURN server. The values are taken from this file; as the comment
  // suggests, not all values may be found in practice:
  //   https://code.google.com/p/chromium/codesearch#chromium/src/third_party/webrtc/p2p/base/port.cc&q=port.cc&l=107
  CANDIDATE,          // signal data to send to peer
  NO_MORE_CANDIDATES  // no more data to send to peer
}

export interface Message {
  // TODO: make an abstraction for the data, only the signal type needs to be
  // known by consumers of this type.
  type          :Type
  // The |candidate| parameter is set iff type === CANDIDATE
  candidate     ?:freedom.RTCPeerConnection.RTCIceCandidate;
  // The |description| parameter is set iff type === OFFER or
  // type === ANSWER
  description   ?:freedom.RTCPeerConnection.RTCSessionDescription;
}
