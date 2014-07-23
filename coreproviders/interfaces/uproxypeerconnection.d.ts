/// <reference path="../../third_party/typings/tsd.d.ts" />

// TODO: rename once https://github.com/Microsoft/TypeScript/issues/52 is fixed
declare module freedom_UproxyPeerConnection {
  // These types essentially just wrap a primitive (string in both instances)
  // for various messages emitted by UproxyPeerConnection.
  interface SignallingMessage {
    message: string;
  }
  interface DataChannel {
    channelLabel: string;
  }

  // Associates a channel label with a WebRtc.Data, for fromPeerData events.
  interface LabelledDataChannelMessage {
    channelLabel: string;
    message: WebRtc.Data
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

    negotiateConnection() : Promise<WebRtc.ConnectionAddresses>;

    handleSignalMessage(signal:freedom_UproxyPeerConnection.SignallingMessage) : Promise<void>;

    // Fulfills once the data channel has been successfully opened,
    // i.e. this is equivalent to PeerConnection.openDataChannel().onceOpened().
    // TODO: add options argument
    openDataChannel(channelLabel: string) : Promise<void>;

    // As per PeerConnection, this fulfills once the supplied data
    // has been sucessfully sent to the peer.
    send(channelLabel:string, data:WebRtc.Data) : Promise<void>;

    // TODO: getState, for both peer connection and data channels
    // TODO: close
    // TODO: onceConnecting, onceConnected, and onceDisconnected

    on(t:string, f:Function) : Promise<void>;
    on(t:'onSignalMessage', f:(signal:freedom_UproxyPeerConnection.SignallingMessage) => any) : Promise<void>;
    on(t:'peerCreatedChannel', f:(channel:freedom_UproxyPeerConnection.DataChannel) => any) : Promise<void>;
    on(t:'fromPeerData', f:(channel:freedom_UproxyPeerConnection.LabelledDataChannelMessage) => any) : Promise<void>;
  }
// }
