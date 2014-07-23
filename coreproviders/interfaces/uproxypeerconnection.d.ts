/// <reference path="../../third_party/typings/tsd.d.ts" />

declare module freedom.UproxyPeerConnection {
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

declare module freedom {
  // TODO: Add remaining methods from peerconnection.d.ts.
  interface UproxyPeerConnection {

    negotiateConnection() : Promise<freedom.UproxyPeerConnection.ConnectionAddresses>;

    handleSignalMessage(signal:freedom.UproxyPeerConnection.SignallingMessage) : Promise<void>;

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
    on(t:'onSignalMessage', f:(signal:freedom.UproxyPeerConnection.SignallingMessage) => any) : Promise<void>;
    on(t:'peerCreatedChannel', f:(channel:freedom.UproxyPeerConnection.DataChannel) => any) : Promise<void>;
    on(t:'fromPeerData', f:(channel:freedom.UproxyPeerConnection.DataChannelMessage) => any) : Promise<void>;
  }
}
