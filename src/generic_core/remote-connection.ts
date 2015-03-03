/**
 * remote-connection.ts
 *
 * This file defines a class for a direct remote connection to another machine.
 * It handles the signaling channel between two peers, regardless of permission.
 */
/// <reference path='../rtc-to-net/rtc-to-net.ts' />
/// <reference path='../socks-to-rtc/socks-to-rtc.ts' />

module Core {
  var log :Logging.Log = new Logging.Log('remote-connection');

  export class RemoteConnection {

    public localGettingFromRemote = GettingState.NONE;
    public localSharingWithRemote = SharingState.NONE;

    private bytesSent_ :number = 0;
    private bytesReceived_ :number = 0;

    private socksToRtc_ :SocksToRtc.SocksToRtc = null;
    private rtcToNet_ :RtcToNet.RtcToNet = null;

    private isUpdatePending_ = false;

    //TODO set up a better type for this
    private sendUpdate_ :(x :uProxy.Update, data?:Object) => void;

    constructor(
      sendUpdate :(x :uProxy.Update, data?:Object) => void
    ) {
      this.sendUpdate_ = sendUpdate;
    }

    private createSender_ = (type :uProxy.MessageType) => {
      return (signal :WebRtc.SignallingMessage) => {
        this.sendUpdate_(uProxy.Update.SIGNALLING_MESSAGE, {
          type: type,
          data: signal
        });
      }
    }

    //TODO should probably either return something or throw errors
    public handleSignal = (message :uProxy.Message) => {
      var target :any = null; //this will either be rtcToNet_ or socksToRtc_
      var msg;
      if (uProxy.MessageType.SIGNAL_FROM_CLIENT_PEER === message.type) {
        target = this.rtcToNet_;
      } else if (uProxy.MessageType.SIGNAL_FROM_SERVER_PEER === message.type) {
        target = this.socksToRtc_;
      } else {
        log.warn('Invalid signal', uProxy.MessageType[message.type]);
        return;
      }

      if (!target) {
        log.warn('Received unexpected signal', {
          type: uProxy.MessageType[message.type],
          message: message
        });
        return;
      }

      msg = <WebRtc.SignallingMessage> message.data;

      target.handleSignalFromPeer(msg);
    };

    public startShare = () => {
      this.rtcToNet_ = new RtcToNet.RtcToNet(
        <freedom_RTCPeerConnection.RTCConfiguration> {
          iceServers: core.globalSettings.stunServers
        },
        <RtcToNet.ProxyConfig> {
          allowNonUnicast: false
        }
      );

      this.rtcToNet_.signalsForPeer.setSyncHandler(this.createSender_(uProxy.MessageType.SIGNAL_FROM_SERVER_PEER));
      this.rtcToNet_.bytesReceivedFromPeer.setSyncHandler(this.handleBytesReceived_);
      this.rtcToNet_.bytesSentToPeer.setSyncHandler(this.handleBytesSent_);

      this.rtcToNet_.onceClosed.then(() => {
        this.localSharingWithRemote = SharingState.NONE;
        this.sendUpdate_(uProxy.Update.STOP_GIVING);
        this.rtcToNet_ = null;
        this.bytesSent_ = 0;
        this.bytesReceived_ = 0;
        this.stateRefresh_();
      });

      this.localSharingWithRemote = SharingState.TRYING_TO_SHARE_ACCESS;
      this.stateRefresh_();

      this.rtcToNet_.onceReady.then(() => {
        this.localSharingWithRemote = SharingState.SHARING_ACCESS;
        this.sendUpdate_(uProxy.Update.START_GIVING);
        this.stateRefresh_();
      }).catch((e) => {
        this.localSharingWithRemote = SharingState.NONE;
        this.stateRefresh_();
        this.rtcToNet_ = null;
      });
    }

    public stopShare = () => {
      if (this.localSharingWithRemote === SharingState.NONE) {
        log.warn('Cannot stop when not proxying');
        return;
      }

      this.localSharingWithRemote = SharingState.NONE;
      this.rtcToNet_.close();
      this.stateRefresh_();
    }

    public startGet = () :Promise<Net.Endpoint> => {
      if (GettingState.NONE !== this.localGettingFromRemote) {
        // This should not happen. If it does, something else is broken. Still, we
        // continue to actually proxy through the instance.
        throw new Error('Currently have a connection open');
      }

      // TODO: sync properly between the extension and the app on proxy settings
      // rather than this cooincidentally the same data.
      if (null != this.socksToRtc_) {
        throw new Error('socksToRtc_ already exists');
      }

      this.socksToRtc_ = new SocksToRtc.SocksToRtc();

      // set up basic handlers
      this.socksToRtc_.on('signalForPeer', this.createSender_(uProxy.MessageType.SIGNAL_FROM_CLIENT_PEER));
      this.socksToRtc_.on('bytesReceivedFromPeer', this.handleBytesReceived_);
      this.socksToRtc_.on('bytesSentToPeer', this.handleBytesSent_);

      this.socksToRtc_.on('stopped', () => {
        // Stopped event is only considered an error if the user had been
        // getting access and we hadn't called this.socksToRtc_.stop
        // If there is an error when trying to start proxying, and a stopped
        // event is fired, an error will be displayed as a result of the start
        // promise rejecting.
        // TODO: consider removing error field from STOP_GETTING_FROM_FRIEND
        // The UI should know whether it was a user-initiated stopped event
        // or not (based on whether they clicked stop/logout, or based on
        // whether the browser's proxy was set).

        var isError = GettingState.GETTING_ACCESS === this.localGettingFromRemote;
        this.sendUpdate_(uProxy.Update.STOP_GETTING, isError);

        this.localGettingFromRemote = GettingState.NONE;
        this.bytesSent_ = 0;
        this.bytesReceived_ = 0;
        this.stateRefresh_();
        this.socksToRtc_ = null;
      });

      this.localGettingFromRemote = GettingState.TRYING_TO_GET_ACCESS;
      this.stateRefresh_();

      return this.socksToRtc_.start(
          <Net.Endpoint> {
            address: '127.0.0.1',
            port: 0
          },
          <freedom_RTCPeerConnection.RTCConfiguration> {
            iceServers: core.globalSettings.stunServers
          }
      ).then((endpoint :Net.Endpoint) => {
        this.localGettingFromRemote = GettingState.GETTING_ACCESS;
        this.stateRefresh_();
        return endpoint;
      }).catch((e :Error) => {
        this.localGettingFromRemote = GettingState.NONE;
        this.stateRefresh_();
        return Promise.reject(Error('Could not start proxy'));
      });
    }

    public stopGet = () : void => {
      if (this.localGettingFromRemote === GettingState.NONE) {
        log.warn('Cannot stop proxying when not proxying');
        return;
      }

      this.localGettingFromRemote = GettingState.NONE;
      this.socksToRtc_.stop();
      this.stateRefresh_();
    }

    /*
     * This handles doing a delayed call to the stateRefresh_ function for any
     * updates we expect to be extremely common but do not need immediate
     * information about (i.e. bytes sent/received).  The update is delayed by
     * a second and we will not do any other updates in the meantime.
     */
    private delayedUpdate_ = () => {
      if (!this.isUpdatePending_) {
        setTimeout(() => {
          this.stateRefresh_();
          this.isUpdatePending_ = false;
        }, 1000);
        this.isUpdatePending_ = true;
      }
    }

    private handleBytesReceived_ = (bytes :number) => {
      this.bytesReceived_ += bytes;
      this.delayedUpdate_();
    }

    private handleBytesSent_ = (bytes :number) => {
      this.bytesSent_ += bytes;
      this.delayedUpdate_();
    }

    private stateRefresh_ = () => {
      this.sendUpdate_(uProxy.Update.STATE, cloneDeep({
        bytesSent: this.bytesSent_,
        bytesReceived: this.bytesReceived_,
        localGettingFromRemote: this.localGettingFromRemote,
        localSharingWithRemote: this.localSharingWithRemote
      }));
    }
  }
}
