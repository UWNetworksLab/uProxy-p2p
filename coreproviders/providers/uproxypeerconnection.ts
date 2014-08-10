/// <reference path="uproxypeerconnection.d.ts" />
/// <reference path="../../peerconnection/peerconnection.d.ts" />
/// <reference path="../../freedom-declarations/freedom.d.ts" />

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
      config:WebRtc.PeerConnectionConfig) {

    // TODO: Remove when objects-for-constructors is fixed in Freedom:
    //         https://github.com/freedomjs/freedom/issues/87
    if (Array.isArray(config)) {
      // Extract the first element of this single element array.
      config = (<WebRtc.PeerConnectionConfig[]><any> config)[0];
    }

    this.pc_ = new WebRtc.PeerConnection(config);

    // Re-dispatch various messages as Freedom messages.
    this.pc_.signalForPeerQueue.setSyncHandler(
        (signal:WebRtc.SignallingMessage) => {
      this.dispatchEvent_('signalForPeer', signal);
    });
    this.pc_.peerOpenedChannelQueue.setSyncHandler(
        (dataChannel:WebRtc.DataChannel) => {
      // Re-dispatch events from this new data channel.
      this.dispatchDataChannelEvents_(dataChannel);
      this.dispatchEvent_('peerOpenedChannel', dataChannel.getLabel());
    });
  }

  public handleSignalMessage(
      signal:WebRtc.SignallingMessage,
      continuation:() => void) : void {
    // TODO: make continuation only get called after signal message has been
    // handled.
    this.pc_.handleSignalMessage(signal);
    continuation();
  }

  public negotiateConnection = (continuation:(endpoints:WebRtc.ConnectionAddresses) => void) : void => {
    // TODO: propagate errors
    this.pc_.negotiateConnection().then(continuation);
  }

  public close = (continuation:() => void) : void => {
    // TODO: propagate errors
    this.pc_.close();
    this.pc_.onceDisconnected.then(continuation);
  }

  public onceConnected = (continuation:(endpoints:WebRtc.ConnectionAddresses) => void) : void => {
    // TODO: propagate errors
    this.pc_.onceConnected.then(continuation);
  }

  public onceConnecting = (continuation:() => void) : void => {
    // TODO: propagate errors
    this.pc_.onceConnecting.then(continuation);
  }

  public onceDisconnected = (continuation:() => void) : void => {
    // TODO: propagate errors
    this.pc_.onceDisconnected.then(continuation);
  }

  //---------------------------------------------------------------------------
  // Data channels.

  public onceDataChannelClosed =
      (channelLabel:string, continuation:() => void) : void => {
    this.pc_.dataChannels[channelLabel].onceClosed.then(continuation);
  }

  // Re-dispatches data channel events, such as receiving data, as
  // Freedom messages.
  private dispatchDataChannelEvents_ = (dataChannel:WebRtc.DataChannel) => {
    dataChannel.dataFromPeerQueue.setSyncHandler((data:WebRtc.Data) => {
      this.dispatchEvent_('dataFromPeer',
        { channelLabel: dataChannel.getLabel(),
          message: data });
    });
  }

  public openDataChannel = (channelLabel :string,
                            continuation :() => void) : void => {
    var dataChannel = this.pc_.openDataChannel(channelLabel);
    dataChannel.onceOpened.then(() => {
      this.dispatchDataChannelEvents_(dataChannel);
      // TODO: propagate errors
      continuation();
    });
  }

  public closeDataChannel =
      (channelLabel :string, continuation :() => void) : void => {
    var dataChannel = this.pc_.dataChannels[channelLabel];
    dataChannel.close();
    continuation();
  }

  public send = (channelLabel :string,
                 data :WebRtc.Data,
                 continuation :() => void) : void => {
    // TODO: propagate errors
    this.pc_.dataChannels[channelLabel].send(data).then(continuation);
  }
}

declare var fdom:freedom.CoreProviderEnv.Fdom;
fdom.apis.register('core.uproxypeerconnection', UproxyPeerConnectionImpl);
