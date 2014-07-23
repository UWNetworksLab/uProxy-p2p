/// <reference path="../../third_party/typings/tsd.d.ts" />

// TODO: rename once https://github.com/Microsoft/TypeScript/issues/52 is fixed
declare module freedom_UproxyPeerConnection {
  // TODO: This flattens WebRtc.ConnectionAddresses; can we do nested
  //       structures in Freedom?
  interface ConnectionAddresses {
    localAddress: string;
    localPort: number;
    remoteAddress: string;
    remotePort: number;
  }

  // TODO: This reduces PeerConnection's relatively complex
  //       SignallingMessage with a string.
  interface SignallingMessage {
    message: string;
  }

  // Rather than representing a data channel, as WebRtc.DataChannel does, this
  // is simply used for data channel-related notifications.
  interface DataChannel {
    channelLabel: string;
  }

  // TODO: This is an awkward mish-mash of WebRtc.Data and a channel label.
  interface DataChannelMessage {
    channelLabel: string;
    str ?:string;
    buffer ?:Uint8Array;
  }
}

// TODO: uncomment once https://github.com/Microsoft/TypeScript/issues/52 is fixed
// declare module freedom {
  // Thin wrapper over WebRtc.PeerConnection.
  // 
  // Some accomodations to Freedom message passing have had to be made:
  //  - As DataChannel objects cannot be returned by or passed as arguments,
  //    they must be accessed via this class, by label.
  //  - Some of the arguments to PeerConnection are too complex to
  //    be expressed in Freedom-ese, e.g. PeerConnectionConfig.
  //    
  // Additionally, note that while TypeScript interfaces cannot specify
  // arguments, the implementation of this class accepts a JSON-ified
  // PeerConnectionConfig instance.
  interface freedom_UproxyPeerConnection {

    negotiateConnection() : Promise<freedom_UproxyPeerConnection.ConnectionAddresses>;

    handleSignalMessage(signal:freedom_UproxyPeerConnection.SignallingMessage) : Promise<void>;

    // Fulfills once the data channel has been successfully opened,
    // i.e. this is equivalent to PeerConnection.openDataChannel().onceOpened().
    // TODO: add options argument
    openDataChannel(channelLabel: string) : Promise<void>;

    // TODO: Move str and buffer to their own object
    send(channelLabel?:string, str?:string, buffer?:ArrayBuffer) : Promise<void>;

    // TODO: getState, for both peer connection and data channels
    // TODO: close
    // TODO: onceConnecting, onceConnected, and onceDisconnected

    on(t:string, f:Function) : Promise<void>;
    on(t:'onSignalMessage', f:(signal:freedom_UproxyPeerConnection.SignallingMessage) => any) : Promise<void>;
    on(t:'peerCreatedChannel', f:(channel:freedom_UproxyPeerConnection.DataChannel) => any) : Promise<void>;
    on(t:'fromPeerData', f:(channel:freedom_UproxyPeerConnection.DataChannelMessage) => any) : Promise<void>;
  }
// }
