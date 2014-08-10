// Typescript file for core.peer-connection in:
// https://github.com/freedomjs/freedom/blob/master/interface/core.js

/// <reference path="../../third_party/typings/es6-promise/es6-promise.d.ts" />
/// <reference path='freedom.d.ts' />

declare module freedom_PeerConnection {
  interface DataChannelInfo {
    channelLabel :string;
  }

  interface DataChannelMessage extends DataChannelInfo {
    // Exactly one of the below must be specified.
    text          ?:string;
    buffer        ?:ArrayBuffer;
    binary        ?:Blob;  // Not yet supported in Chrome.
  }
}

// TODO uncomment & rename once Typescript issue #52 is fixed
//declare module  {
  // TODO: clarify semantics of close w.r.t. getBufferedAmount: does it close
  // after the buffered amount is set to zero? Or does it throw away what is
  // in the buffer?

  // TODO: add issue for `onOpenDataChannel` to have return value field named
  // `channelLabel`, not `channelId`, to be consistent with `onReceived`.
  interface freedom_PeerConnection {
    // Setup a new peer connection.
    setup(freedomChannelId  :freedom.ChannelEndpointIdentifier,
          debugName:string,  // used for debugging messages.
          stunServers:string[])
        : Promise<void>;

    // Send a message, if the channelLabel does not exist, it is created. TODO:
    // clarify semantics: does a channel created by this class raise an
    // `onOpenDataChannel` event?
    send(d:freedom_PeerConnection.DataChannelMessage) : void;
    openDataChannel(channelLabel:string) : Promise<void>;
    closeDataChannel(channelLabel:string) : Promise<void>;
    close() : Promise<void>;

    // Generic freedom `on` handler.
    on(t:string, f:Function) : void;
    on(t:'onReceived', f:(d:freedom_PeerConnection.DataChannelMessage) => void) : void;
    on(t:'onClose', f:() => void) : void;
    // The |onOpenDataChannel| and |onCloseDataChannel| events happen when the
    // remote peer opens or closes a connection to this peer-connection.
    on(t:'onOpenDataChannel', f:(d:freedom_PeerConnection.DataChannelInfo) => void)
        : void;
    on(t:'onCloseDataChannel', f:(d:freedom_PeerConnection.DataChannelInfo) => void)
        : void;

    // Given a channel Label, returns the buffered amount on that channel. TODO:
    // this should probably not be exposed. buffering should be handled inside.
    getBufferedAmount(channelLabel:string) : Promise<number>;
  }
//}
