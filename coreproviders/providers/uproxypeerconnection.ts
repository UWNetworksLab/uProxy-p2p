/// <reference path="../interfaces/uproxypeerconnection.d.ts" />
/// <reference path="../../peerconnection/peerconnection.d.ts" />

// Note that this can't implement UproxyPeerConnection interface due to the
// continuation parameter, so we lose quite a bit of type safety.
class UproxyPeerConnectionImpl {
  // Instance under wraps.
  private pc_ :WebRtc.PeerConnection;

  constructor(
      private module_:any,
      private dispatchEvent_:any,
      pcConfigAsJson:any) {
    this.pc_ = new WebRtc.PeerConnection(JSON.parse(pcConfigAsJson));

    // Re-dispatch various messages as Freedom messages.
    this.pc_.toPeerSignalQueue.setSyncHandler((signal:WebRtc.SignallingMessage) => {
      this.dispatchEvent_('signalMessage', {
        message: JSON.stringify(signal)
      });
    });
    this.pc_.peerCreatedChannelQueue.setSyncHandler((dataChannel:WebRtc.DataChannel) => {
      // Re-dispatch events from this new data channel.
      this.dispatchDataChannelEvents_(dataChannel);
      this.dispatchEvent_('peerCreatedChannel', {
        channelLabel: dataChannel.getLabel()
      });
    });
  }

  ////////
  // Signalling channel.
  ////////

  public handleSignalMessage(
      signal:freedom_UproxyPeerConnection.SignallingMessage,
      continuation:() => any) : void {
    this.pc_.handleSignalMessage(JSON.parse(signal.message));
    continuation();
  }

  public negotiateConnection = (continuation:(endpoints:WebRtc.ConnectionAddresses) => any) : void => {
    // TODO: propagate errors
    this.pc_.negotiateConnection().then((endpoints:WebRtc.ConnectionAddresses) => {
      continuation(endpoints);
    });
  }

  ////////
  // Data channels.
  ////////

  // Re-dispatches data channel events, such as receiving data, as
  // Freedom messages.
  private dispatchDataChannelEvents_ = (dataChannel:WebRtc.DataChannel) => {
    dataChannel.fromPeerDataQueue.setSyncHandler((data:WebRtc.Data) => {
      this.dispatchEvent_('fromPeerData', {
        channelLabel: dataChannel.getLabel(),
        message: {
          str: data.str,
          buffer: data.buffer
        }
      });
    });
  }

  public openDataChannel = (
      channelLabel: string,
      continuation:() => any) : void => {
    var dataChannel = this.pc_.openDataChannel(channelLabel);
    dataChannel.onceOpened.then(() => {
      this.dispatchDataChannelEvents_(dataChannel);
      // TODO: propagate errors
      continuation();
    });
  }

  public send = (
      channelLabel:string,
      data:WebRtc.Data,
      continuation ?:() => any) : void => {
    // TODO: propagate errors
    this.pc_.dataChannels[channelLabel].send(data).then(continuation);
  }
}

declare var fdom:any;
fdom.apis.register('core.uproxypeerconnection', UproxyPeerConnectionImpl);
