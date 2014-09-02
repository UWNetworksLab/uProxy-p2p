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
        // TODO: fix `any` type: https://github.com/uProxy/uproxy/issues/353
        private module_:any,
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

    public handleSignalMessage = (
        signal:WebRtc.SignallingMessage,
        continuation:CoreProviderCallback<void>) : void => {
      // TODO: make continuation only get called after signal message has been
      // handled.
      this.pc_.handleSignalMessage(signal);
      continuation();
    }

    public negotiateConnection =
        (continuation:CoreProviderCallback<WebRtc.ConnectionAddresses>)
        : void => {
      this.pc_.negotiateConnection()
        .then(continuation)
        .catch((e:Error) => {
          continuation(null, {
            'errcode': 'ERROR',
            'message': this.pc_.peerName +
              ': negotiateConnection: error: ' + e.toString()
          });
        });
    }

    public close = (continuation:CoreProviderCallback<void>) : void => {
      this.pc_.close();
      this.pc_.onceDisconnected
        .then(continuation)
        .catch((e:Error) => {
          continuation(null, {
            'errcode': 'ERROR',
            'message': this.pc_.peerName +
              ': close: error: ' + e.toString()
          });
        });
    }

    public onceConnected =
        (continuation:CoreProviderCallback<WebRtc.ConnectionAddresses>)
        : void => {
      this.pc_.onceConnected
        .then(continuation)
        .catch((e:Error) => {
          continuation(null, {
            'errcode': 'ERROR',
            'message': this.pc_.peerName +
              ': onceConnected: error: ' + e.toString()
          });
        });
    }

    public onceConnecting = (continuation:CoreProviderCallback<void>)
        : void => {
      this.pc_.onceConnecting
        .then(continuation)
        .catch((e:Error) => {
          continuation(null, {
            'errcode': 'ERROR',
            'message': this.pc_.peerName +
              ': onceConnecting: error: ' + e.toString()
          });
        });
    }

    public onceDisconnected =
        (continuation:CoreProviderCallback<void>) : void => {
      this.pc_.onceDisconnected
        .then(continuation)
        .catch((e:Error) => {
          continuation(null, {
            'errcode': 'ERROR',
            'message': this.pc_.peerName +
              ': onceDisconnected: error: ' + e.toString()
          });
        });
    }

    //---------------------------------------------------------------------------
    // Data channels.

    public onceDataChannelClosed = (channelLabel:string,
        continuation:CoreProviderCallback<void>) : void => {
      if (channelLabel in this.pc_.dataChannels) {
        this.pc_.dataChannels[channelLabel].onceClosed.then(continuation);
      } else {
        // If channelLabel is not in pc_ list of data channels, pc_ must have
        // already closed it. So call continuation directly.
        continuation();
      }
    }

    public onceDataChannelOpened = (channelLabel:string,
        continuation:CoreProviderCallback<void>) : void => {
      if (channelLabel in this.pc_.dataChannels) {
        this.pc_.dataChannels[channelLabel].onceOpened.then(continuation);
      } else {
        continuation(null, {
          'errcode': 'NO_SUCH_DATA_CHANNEL',
          'message': this.pc_.peerName +
            ': onceDataChannelOpened: non-existant label: ' + channelLabel
        });
      }
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
        continuation:CoreProviderCallback<void>) : void => {
      var dataChannel = this.pc_.openDataChannel(channelLabel);
      dataChannel.onceOpened
        .then(() => {
          this.dispatchDataChannelEvents_(dataChannel)
          continuation();
        })
        .catch((e:Error) => {
          continuation(null, {
            'errcode': 'ERROR',
            'message': this.pc_.peerName + ': openDataChannel: ' + e.toString()
          });
        });
    }

    public closeDataChannel = (channelLabel :string,
        continuation:CoreProviderCallback<void>) : void => {
      // When a data channel is closed by the remote peer the underlying
      // peerconnection will have removed it, so we need to check it exists
      // first.
      if (channelLabel in this.pc_.dataChannels) {
        this.pc_.dataChannels[channelLabel].close();
      }
      continuation();
    }

    public send = (channelLabel :string,
                   data :WebRtc.Data,
                   continuation:CoreProviderCallback<void>) : void => {
      if(!(channelLabel in this.pc_.dataChannels)) {
        continuation(null, {
            'errcode': 'NO_SUCH_DATA_CHANNEL',
            'message': this.pc_.peerName +
                ': send: non-existant label: ' + channelLabel
          });
        return
      }

      this.pc_.dataChannels[channelLabel].send(data)
        .then(continuation)
        .catch((e:Error) => {
          continuation(null, {
            'errcode': 'ERROR',
            'message': this.pc_.peerName + ': send: ' + e.toString()
          });
        });
    }
  }  // class FreedomImpl
}  // module UproxyPeerConnection
