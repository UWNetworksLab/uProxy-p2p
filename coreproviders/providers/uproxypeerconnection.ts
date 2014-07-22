/// <reference path="../interfaces/uproxypeerconnection.d.ts" />
/// <reference path="../../peerconnection/peerconnection.d.ts" />

// This can't implement UproxyPeerConnection interface due to the
// continuation parameter.
class UproxyPeerConnectionImpl {
  // Instance under wraps.
  private pc_ :WebRtc.PeerConnection;

  constructor(
      private module_:any,
      private dispatchEvent_:any,
      pcConfigAsJson:any) {
    this.pc_ = new WebRtc.PeerConnection(JSON.parse(pcConfigAsJson));
    // Re-dispatch signalling channel messages as Freedom messages.
    this.pc_.toPeerSignalQueue.setSyncHandler((signal:WebRtc.SignallingMessage) => {
      this.dispatchEvent_('signalMessage', {
        message: JSON.stringify(signal)
      });
    });
  }

  public handleSignalMessage(
      signal:SignallingMessage,
      continuation:() => any) : void {
    this.pc_.handleSignalMessage(JSON.parse(signal.message));
    continuation();
  }

  public negotiateConnection = (continuation:(endpoints:ConnectionAddresses) => void) : void => {
    // TODO: propagate errors
    this.pc_.negotiateConnection().then((endpoints:WebRtc.ConnectionAddresses) => {
      continuation({
        localAddress: endpoints.local.address,
        localPort: endpoints.local.port,
        remoteAddress: endpoints.remote.address,
        remotePort: endpoints.remote.port
      });
    });
  }
}

declare var fdom:any;
fdom.apis.register('core.uproxypeerconnection', UproxyPeerConnectionImpl);
