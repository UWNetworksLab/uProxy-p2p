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
}

declare module freedom {
  // TODO: Typing for the constructor.
  //       Note that interfaces can't have constructors.
  // TODO: Add remaining methods from peerconnection.d.ts.
  interface UproxyPeerConnection {
    // Signalling channel.
    handleSignalMessage(signal:freedom.UproxyPeerConnection.SignallingMessage) : Promise<void>;
    on(t:string, f:Function) : Promise<void>;
    on(t:'onSignalMessage', f:(signal:freedom.UproxyPeerConnection.SignallingMessage) => any) : Promise<void>;

    negotiateConnection() : Promise<freedom.UproxyPeerConnection.ConnectionAddresses>;

    // Data channels.
  }
}
