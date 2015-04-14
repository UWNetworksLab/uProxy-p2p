/**
 * remote-connection.ts
 *
 * This file defines a class for a direct remote connection to another machine.
 * It handles the signaling channel between two peers, regardless of permission.
 */

import logging = require('../../../third_party/uproxy-lib/logging/logging');
import net = require('../../../third_party/uproxy-networking/net/net.types');
import rtc_to_net = require('../../../third_party/uproxy-networking/rtc-to-net/rtc-to-net');
import social = require('../interfaces/social');
import socks_to_rtc = require('../../../third_party/uproxy-networking/socks-to-rtc/socks-to-rtc');
import uproxy_core_api = require('../interfaces/uproxy_core_api');

// module Core {
  var log :logging.Log = new logging.Log('remote-connection');

  export class RemoteConnection {

    public localGettingFromRemote = social.GettingState.NONE;
    public localSharingWithRemote = social.SharingState.NONE;

    private bytesSent_ :number = 0;
    private bytesReceived_ :number = 0;

    private socksToRtc_ :socks_to_rtc.SocksToRtc = null;
    private rtcToNet_ :rtc_to_net.RtcToNet = null;

    private isUpdatePending_ = false;

    // Resolve this promise when rtcToNet is created and therefore not null.
    // Used to help determine when to call handleSignal (which relies
    // on rtcToNet or socksToRtc being not null).
    // The promise is reset in resetSharerCreated().
    public onceSharerCreated :Promise<void> = null;
    // Helper function used to fulfill onceSharerCreated.
    private fulfillRtcToNetCreated_ :Function;
    private sharingReset_ :Promise<void> = null;

    // TODO: set up a better type for this
    private sendUpdate_ :(x :uproxy_core_api.Update, data?:Object) => void;

    constructor(
      sendUpdate :(x :uproxy_core_api.Update, data?:Object) => void
    ) {
      this.sendUpdate_ = sendUpdate;
      this.resetSharerCreated();
    }

    private createSender_ = (type :social.PeerMessageType) => {
      return (signal :WebRtc.SignallingMessage) => {
        this.sendUpdate_(uproxy_core_api.Update.SIGNALLING_MESSAGE, {
          type: type,
          data: signal
        });
      }
    }

    // TODO: should probably either return something or throw errors
    public handleSignal = (message :social.PeerMessage) => {
      var target :any = null; //this will either be rtcToNet_ or socksToRtc_
      var msg;
      if (social.PeerMessageType.SIGNAL_FROM_CLIENT_PEER === message.type) {
        target = this.rtcToNet_;
      } else if (social.PeerMessageType.SIGNAL_FROM_SERVER_PEER === message.type) {
        target = this.socksToRtc_;
      } else {
        log.warn('Invalid signal', social.PeerMessageType[message.type]);
        return;
      }

      if (!target) {
        log.warn('Received unexpected signal', {
          type: social.PeerMessageType[message.type],
          message: message
        });
        return;
      }

      msg = <WebRtc.SignallingMessage> message.data;

      target.handleSignalFromPeer(msg);
    };

    public startShare = () :Promise<void> => {
      if (this.rtcToNet_) {
        throw new Error('rtcToNet_ already exists');
      }

      this.rtcToNet_ = new RtcToNet.RtcToNet(
        <freedom_RTCPeerConnection.RTCConfiguration> {
          iceServers: core.globalSettings.stunServers
        },
        <RtcToNet.ProxyConfig> {
          allowNonUnicast: core.globalSettings.allowNonUnicast
        }
      );

      this.rtcToNet_.signalsForPeer.setSyncHandler(this.createSender_(social.PeerMessageType.SIGNAL_FROM_SERVER_PEER));
      this.rtcToNet_.bytesReceivedFromPeer.setSyncHandler(this.handleBytesReceived_);
      this.rtcToNet_.bytesSentToPeer.setSyncHandler(this.handleBytesSent_);

      this.sharingReset_ = this.rtcToNet_.onceClosed.then(() => {
        this.localSharingWithRemote = SharingState.NONE;
        this.sendUpdate_(uproxy_core_api.Update.STOP_GIVING);
        this.rtcToNet_ = null;
        this.bytesSent_ = 0;
        this.bytesReceived_ = 0;
        this.stateRefresh_();
      });

      this.localSharingWithRemote = SharingState.TRYING_TO_SHARE_ACCESS;
      this.stateRefresh_();
      this.fulfillRtcToNetCreated_();

      this.rtcToNet_.onceReady.then(() => {
        this.localSharingWithRemote = SharingState.SHARING_ACCESS;
        this.sendUpdate_(uproxy_core_api.Update.START_GIVING);
        this.stateRefresh_();
      }).catch((e) => {
        this.stopShare();
      });

      return this.rtcToNet_.onceReady;
    }

    // This *must* be called if you receive an OFFER signal while there is an existing
    // rtcToNet_ instance. Right before you stop the existing instance, make a call to
    // this function so that CANDIDATEs received after the new OFFER will know to wait
    // for a new rtcToNet_ instance to be created. Otherwise, CANDIDATE signals can be
    // dropped or handled by old rtcToNet_ instances.
    public resetSharerCreated = () :void => {
      this.onceSharerCreated = new Promise<void>((F, R) => {
        this.fulfillRtcToNetCreated_ = F;
      });
    }

    public stopShare = () :Promise<void> => {
      if (this.localSharingWithRemote === SharingState.NONE) {
        log.warn('Cannot stop sharing when neither sharing nor trying to share.');
        return Promise.resolve<void>();
      }

      this.localSharingWithRemote = SharingState.NONE;
      this.stateRefresh_();
      this.rtcToNet_.close();
      return this.sharingReset_;
    }

    public startGet = () :Promise<Net.Endpoint> => {
      if (this.localGettingFromRemote !== social.GettingState.NONE) {
        // This should not happen. If it does, something else is broken. Still, we
        // continue to actually proxy through the instance.
        throw new Error('Currently have a connection open');
      }

      // TODO: sync properly between the extension and the app on proxy settings
      // rather than this cooincidentally the same data.
      if (null != this.socksToRtc_) {
        throw new Error('socksToRtc_ already exists');
      }

      this.socksToRtc_ = new socks_to_rtc.SocksToRtc();

      // set up basic handlers
      this.socksToRtc_.on('signalForPeer', this.createSender_(social.PeerMessageType.SIGNAL_FROM_CLIENT_PEER));
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

        var isError = social.GettingState.GETTING_ACCESS === this.localGettingFromRemote;
        this.sendUpdate_(uproxy_core_api.Update.STOP_GETTING, isError);

        this.localGettingFromRemote = social.GettingState.NONE;
        this.bytesSent_ = 0;
        this.bytesReceived_ = 0;
        this.stateRefresh_();
        this.socksToRtc_ = null;
      });

      this.localGettingFromRemote = social.GettingState.TRYING_TO_GET_ACCESS;
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
        this.localGettingFromRemote = social.GettingState.GETTING_ACCESS;
        this.stateRefresh_();
        return endpoint;
      }).catch((e :Error) => {
        this.localGettingFromRemote = social.GettingState.NONE;
        this.stateRefresh_();
        return Promise.reject(Error('Could not start proxy'));
      });
    }

    public stopGet = () :Promise<void> => {
      if (this.localGettingFromRemote === social.GettingState.NONE) {
        log.warn('Cannot stop proxying when neither proxying nor trying to proxy.');
        return;
      }

      this.localGettingFromRemote = social.GettingState.NONE;
      this.stateRefresh_();
      return this.socksToRtc_.stop();
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
      this.sendUpdate_(uproxy_core_api.Update.STATE, {
        bytesSent: this.bytesSent_,
        bytesReceived: this.bytesReceived_,
        localGettingFromRemote: this.localGettingFromRemote,
        localSharingWithRemote: this.localSharingWithRemote
      });
    }
  }
// }
