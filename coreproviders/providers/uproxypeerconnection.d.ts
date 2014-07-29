/// <reference path="../../freedom-declarations/freedom.d.ts" />
/// <reference path="../../third_party/typings/webrtc/RTCPeerConnection.d.ts" />
/// <reference path="../../third_party/typings/es6-promise/es6-promise.d.ts" />

// TODO: rename once https://github.com/Microsoft/TypeScript/issues/52 is fixed
declare module freedom_UproxyPeerConnection {
  // Associates a channel label with a WebRtc.Data, for fromPeerData events.
  interface LabelledDataChannelMessage {
    channelLabel: string;
    message: WebRtc.Data;
  }

  // This is the interface for the object returned by
  // freedom['WebRtc.PeerConnection'], which is a thin wrapper over
  // WebRtc.PeerConnection.
  //
  // Some accomodations to Freedom message passing have had to be made:
  //  - The relatively complex WebRtc.SignallingMessage interface has been
  //    replaced with opaque strings (they can be decoded with JSON.parse).
  //  - As DataChannel objects cannot be returned by or passed as arguments,
  //    they must be accessed via this class, by label.
  //  - Some of the arguments to PeerConnection are too complex to
  //    be expressed in Freedom-ese, e.g. PeerConnectionConfig.
  //
  // Additionally, note that while TypeScript interfaces cannot specify
  // arguments, the implementation of this class accepts a
  // PeerConnectionConfig instance.
  interface Pc {

    negotiateConnection() : Promise<WebRtc.ConnectionAddresses>;

    handleSignalMessage(signal:WebRtc.SignallingMessage) : Promise<void>;

    // Fulfills once the data channel has been successfully opened,
    // i.e. this is equivalent to PeerConnection.openDataChannel().onceOpened().
    // TODO: add options argument
    openDataChannel(channelLabel: string) : Promise<void>;

    // As per PeerConnection, this fulfills once the supplied data
    // has been sucessfully sent to the peer.
    send(channelLabel:string, data:WebRtc.Data) : Promise<void>;

    // TODO: getState, for both peer connection and data channels
    // TODO: close

    onceConnected() : Promise<WebRtc.ConnectionAddresses>;
    onceConnecting() : Promise<void>;
    onceDisconnected() : Promise<void>;

    // TODO: make a type for events from UproxyPeerConnection and use the same
    // type in the implementation. That way you can get better typechecking.
    // e.g.
    // interface Message {
    //  onSignalMessage: string;
    //  peerCreatedChannel: string;
    //  fromPeerData: LabelledDataChannelMessage;
    //}
    on(t:string, f:(eventData:any) => void) : void;
    on(t:'onSignalMessage', f:(signal:WebRtc.SignallingMessage) => void) : void;
    on(t:'peerCreatedChannel', f:(channelLabel:string) => void) : void;
    on(t:'fromPeerData', f:(message:LabelledDataChannelMessage) => void)
        : void;
  }
}
