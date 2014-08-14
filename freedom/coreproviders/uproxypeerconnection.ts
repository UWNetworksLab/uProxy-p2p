/// <reference path="uproxypeerconnection.d.ts" />
/// <reference path="../../webrtc/peerconnection.d.ts" />
/// <reference path="../../freedom/typings/freedom.d.ts" />
/// <reference path="../../logging/logging.d.ts" />

// Note that this can't implement UproxyPeerConnection interface due to the
// continuation parameter, so we lose quite a bit of type safety.
module freedom_UproxyPeerConnection {
  export class FreedomPcImpl {
    // Instance under wraps.
    private pc_ :WebRtc.PeerConnection;

    // Note: this can't be declared in the module, even though it should only be
    // in the core-provider, because freedom executes the module code even in
    // web-workers.
    private log_ :Logging.Log;

    constructor(
        // TODO: fix `any` type.
        private module_:any,
        // TODO: see comment in .d.ts: use real type not any.
        private dispatchEvent_:(eventType:string, eventData:any) => void,
        config:WebRtc.PeerConnectionConfig) {

      this.log_ = new Logging.Log('uproxy-peerconnection-freedom-wrapper');

      this.log_.debug('making new pc from config: ' + JSON.stringify(config));

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

    public handleSignalMessage =
        (signal:WebRtc.SignallingMessage, continuation:() => void) : void => {
      // TODO: make continuation only get called after signal message has been
      // handled.
      this.pc_.handleSignalMessage(signal);
      continuation();
    }

    public negotiateConnection =
        (continuation:(endpoints:WebRtc.ConnectionAddresses) => void)
        : void => {
      // TODO: propagate errors
      this.pc_.negotiateConnection()
        .then(continuation)
        .catch((e:Error) => {
          this.log_.error(e.toString());
          // TODO: propagate errors
        });
    }

    public close = (continuation:() => void) : void => {
      this.pc_.close();
      this.pc_.onceDisconnected
        .then(continuation)
        .catch((e:Error) => {
          this.log_.error(e.toString());
          // TODO: propagate errors
        });
    }

    public onceConnected =
        (continuation:(endpoints:WebRtc.ConnectionAddresses) => void)
        : void => {
      this.pc_.onceConnected
        .then(continuation)
        .catch((e:Error) => {
          this.log_.error(e.toString());
          // TODO: propagate errors
        });
    }

    public onceConnecting = (continuation:() => void) : void => {
      this.pc_.onceConnecting
        .then(continuation)
        .catch((e:Error) => {
          this.log_.error(e.toString());
          // TODO: propagate errors
        });
    }

    public onceDisconnected = (continuation:() => void) : void => {
      this.pc_.onceDisconnected
        .then(continuation)
        .catch((e:Error) => {
          this.log_.error(e.toString());
          // TODO: propagate errors
        });
    }

    //---------------------------------------------------------------------------
    // Data channels.

    public onceDataChannelClosed =
        (channelLabel:string, continuation:() => void) : void => {
      this.pc_.dataChannels[channelLabel].onceClosed.then(continuation);
    }

    public onceDataChannelOpened =
        (channelLabel:string, continuation:() => void) : void => {
      this.pc_.dataChannels[channelLabel].onceOpened.then(continuation);
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
      dataChannel.onceOpened
        .then(() => {
          this.dispatchDataChannelEvents_(dataChannel)
          continuation();
        })
        .catch((e:Error) => {
          this.log_.error(e.toString());
          // TODO: propagate errors
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
      this.pc_.dataChannels[channelLabel].send(data)
        .then(continuation)
        .catch((e:Error) => {
          this.log_.error(e.toString());
          // TODO: propagate errors
        });
    }
  }  // class FreedomImpl
}  // module UproxyPeerConnection
