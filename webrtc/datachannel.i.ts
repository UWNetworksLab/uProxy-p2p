/// <reference path="../../third_party/typings/es6-promise/es6-promise.d.ts" />

// DataPeer - a class that wraps peer connections and data channels.
//
// This class assumes WebRTC is available; this is provided by the cross-
// platform compatibility library webrtc-adaptor.js (from:
// https://code.google.com/p/webrtc/source/browse/stable/samples/js/base/adapter.js)

import Handler = require('../handler/queue');

export interface Channel {
  // Guarenteed to be invarient for the life of the data channel.
  getLabel : () => string;

  // Promise for when the data channel has been openned.
  onceOpened : Promise<void>;

  // Promise for when the data channel has been closed (only fulfilled after
  // the data channel has been openned).
  // NOTE: There exists a bug in Chrome prior to version 37 which prevents
  //       this from fulfilling on the remote peer.
  onceClosed : Promise<void>;

  // Data from the peer. No data will be added to the queue after |onceClosed|
  // is fulfilled.
  dataFromPeerQueue :Handler.QueueHandler<Data, void>;

  // Send data; promise returns when all the data has been passed on to the
  // undertlying network layer for ending.
  send(data:Data) : Promise<void>;

  // Closes this data channel.
  // A channel cannot be re-opened once this has been called.
  close() : void;

  toString() : string;
}

// Data sent to or received from a peer on a data channel in the peer
// connection.
export interface Data {
  str ?:string;
  buffer ?:ArrayBuffer;
  // TODO: add when supported by WebRtc in Chrome and FF.
  // https://code.google.com/p/webrtc/issues/detail?id=2276
  //
  // bufferView  ?:ArrayBufferView;
  // blob        ?:Blob
  // domString   ?:DOMString
}
