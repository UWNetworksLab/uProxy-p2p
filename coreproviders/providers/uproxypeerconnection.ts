/// <reference path="uproxypeerconnection.d.ts" />
/// <reference path="../../peerconnection/peerconnection.d.ts" />
/// <reference path="../../interfaces/freedom.d.ts" />

// Note that this can't implement UproxyPeerConnection interface due to the
// continuation parameter, so we lose quite a bit of type safety.
class UproxyPeerConnectionImpl {
  // Instance under wraps.
  private pc_ :WebRtc.PeerConnection;

  constructor(
      // TODO: fix `any` type.
      private module_:any,
      // TODO: see comment in .d.ts: use real type not any.
      private dispatchEvent_:(eventType:string, eventData:any) => void,
      // TODO: don't take json string, take the real object and gice it a type.
      pcConfigAsJson:string) {
    this.pc_ = new WebRtc.PeerConnection(JSON.parse(pcConfigAsJson));

    // Re-dispatch various messages as Freedom messages.
    this.pc_.toPeerSignalQueue.setSyncHandler((signal:WebRtc.SignallingMessage) => {
      this.dispatchEvent_('signalMessage', JSON.stringify(signal));
    });
      this.pc_.peerCreatedChannelQueue.setSyncHandler(
          (dataChannel:WebRtc.DataChannel) => {
      // Re-dispatch events from this new data channel.
      this.dispatchDataChannelEvents_(dataChannel);
      this.dispatchEvent_('peerCreatedChannel', dataChannel.getLabel());
    });
  }

  ////////
  // Signalling channel.
  ////////

  public handleSignalMessage(
      signal:string,
      continuation:() => void) : void {
    this.pc_.handleSignalMessage(JSON.parse(signal));
    continuation();
  }

  public negotiateConnection = (continuation:(endpoints:WebRtc.ConnectionAddresses) => void) : void => {
    // TODO: propagate errors
    this.pc_.negotiateConnection().then(continuation);
  }

  public onceConnected = (continuation:(endpoints:WebRtc.ConnectionAddresses) => void) : void => {
    // TODO: propagate errors
    this.pc_.onceConnected.then(continuation);
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
      channelLabel :string,
      continuation :() => void) : void => {
    var dataChannel = this.pc_.openDataChannel(channelLabel);
    dataChannel.onceOpened.then(() => {
      this.dispatchDataChannelEvents_(dataChannel);
      // TODO: propagate errors
      continuation();
    });
  }

  public send = (
      channelLabel :string,
      data :WebRtc.Data,
      continuation :() => void) : void => {
    // TODO: propagate errors
    this.pc_.dataChannels[channelLabel].send(data).then(continuation);
  }
}

declare var fdom:freedom.CoreProviderEnv.Fdom;
fdom.apis.register('core.uproxypeerconnection', UproxyPeerConnectionImpl);
