/**
 * remote-connection.ts
 *
 * This file defines a class for a direct remote connection to another machine.
 * It handles the signaling channel between two peers, regardless of permission.
 */

import globals = require('./globals');
import logging = require('../../../third_party/uproxy-lib/logging/logging');
import net = require('../../../third_party/uproxy-lib/net/net.types');
import rtc_to_net = require('../../../third_party/uproxy-lib/rtc-to-net/rtc-to-net');
import bridge = require('../../../third_party/uproxy-lib/bridge/bridge');
import social = require('../interfaces/social');
import socks_to_rtc = require('../../../third_party/uproxy-lib/socks-to-rtc/socks-to-rtc');
import uproxy_core_api = require('../interfaces/uproxy_core_api');
import peerconnection = require('../../../third_party/uproxy-lib/webrtc/peerconnection');
import tcp = require('../../../third_party/uproxy-lib/net/tcp');

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
      return (signal :bridge.SignallingMessage) => {
        this.sendUpdate_(uproxy_core_api.Update.SIGNALLING_MESSAGE, {
          type: type,
          data: signal
        });
      }
    }

    // TODO: should probably either return something or throw errors
    public handleSignal = (message :social.PeerMessage) => {
      if (social.PeerMessageType.SIGNAL_FROM_CLIENT_PEER === message.type
          && this.rtcToNet_) {
        this.rtcToNet_.handleSignalFromPeer(<bridge.SignallingMessage>message.data);
      } else if (social.PeerMessageType.SIGNAL_FROM_SERVER_PEER === message.type
                 && this.socksToRtc_) {
        this.socksToRtc_.handleSignalFromPeer(<bridge.SignallingMessage>message.data);
      } else {
        log.warn('Invalid signal: ', social.PeerMessageType[message.type]);
        return;
      }
    };

    public startShare = (remoteVersion:number) :Promise<void> => {
      if (this.rtcToNet_) {
        log.error('rtcToNet_ already exists');
        throw new Error('rtcToNet_ already exists');
      }

      var config :freedom_RTCPeerConnection.RTCConfiguration = {
        iceServers: globals.settings.stunServers
      };

      var pc: peerconnection.PeerConnection<Object>;
      if (remoteVersion < 2) {
        log.debug('peer is running client version 1, using old peerconnection');
        pc = new peerconnection.PeerConnectionClass(
          freedom['core.rtcpeerconnection'](config),
          'rtctonet');
      } else {
        log.debug('peer is running client version >1, using bridge');
        pc = bridge.best('rtctonet', config);
      }

      this.rtcToNet_ = new rtc_to_net.RtcToNet();
      this.rtcToNet_.start({
        allowNonUnicast: globals.settings.allowNonUnicast
      }, pc);

      this.rtcToNet_.signalsForPeer.setSyncHandler(this.createSender_(social.PeerMessageType.SIGNAL_FROM_SERVER_PEER));
      this.rtcToNet_.bytesReceivedFromPeer.setSyncHandler(this.handleBytesReceived_);
      this.rtcToNet_.bytesSentToPeer.setSyncHandler(this.handleBytesSent_);

      this.sharingReset_ = this.rtcToNet_.onceStopped.then(() => {
        this.localSharingWithRemote = social.SharingState.NONE;
        this.sendUpdate_(uproxy_core_api.Update.STOP_GIVING);
        this.rtcToNet_ = null;
        this.bytesSent_ = 0;
        this.bytesReceived_ = 0;
        this.stateRefresh_();
      });

      this.localSharingWithRemote = social.SharingState.TRYING_TO_SHARE_ACCESS;
      this.stateRefresh_();
      this.fulfillRtcToNetCreated_();

      this.rtcToNet_.onceReady.then(() => {
        this.localSharingWithRemote = social.SharingState.SHARING_ACCESS;
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
      if (this.localSharingWithRemote === social.SharingState.NONE) {
        log.warn('Cannot stop sharing when neither sharing nor trying to share.');
        return Promise.resolve<void>();
      }

      this.localSharingWithRemote = social.SharingState.NONE;
      this.stateRefresh_();
      this.rtcToNet_.stop();
      return this.sharingReset_;
    }

    public startGet = (remoteVersion:number) :Promise<net.Endpoint> => {
      if (this.localGettingFromRemote !== social.GettingState.NONE) {
        // This should not happen. If it does, something else is broken. Still, we
        // continue to actually proxy through the instance.
        log.error('Currently have a connection open');
        throw new Error('Currently have a connection open');
      }

      // TODO: sync properly between the extension and the app on proxy settings
      // rather than this cooincidentally the same data.
      if (null != this.socksToRtc_) {
        log.error('socksToRtc_ already exists');
        throw new Error('socksToRtc_ already exists');
      }

      this.socksToRtc_ = new socks_to_rtc.SocksToRtc();

      // set up basic handlers
      this.socksToRtc_.on('signalForPeer', this.createSender_(social.PeerMessageType.SIGNAL_FROM_CLIENT_PEER));
      this.socksToRtc_.on('bytesReceivedFromPeer', this.handleBytesReceived_);
      this.socksToRtc_.on('bytesSentToPeer', this.handleBytesSent_);

      // TODO: Change this back to listening to the 'stopped' callback
      // once https://github.com/uProxy/uproxy/issues/1264 is resolved.
      // Currently socksToRtc's 'stopped' callback does not get called on
      // Firefox, possibly due to issues cleaning up sockets.
      // onceStopping_, unlike 'stopped', gets fired as soon as stopping begins
      // and doesn't wait for all cleanup to finish
      this.socksToRtc_['onceStopping_'].then(() => {
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

      var tcpServer = new tcp.Server({
        address: '127.0.0.1',
        port: 0
      });

      var config :freedom_RTCPeerConnection.RTCConfiguration = {
        iceServers: globals.settings.stunServers
      };

      var pc: peerconnection.PeerConnection<Object>;
      if (remoteVersion === 1) {
        log.debug('peer is running client version 1, using old peerconnection');
        pc = new peerconnection.PeerConnectionClass(
          freedom['core.rtcpeerconnection'](config),
          'sockstortc');
      } else if (remoteVersion === 2) {
        log.debug('peer is running client version 2, using bridge without obfuscation');
        pc = bridge.preObfuscation('sockstortc', config);
      } else {
        log.debug('peer is running client version >2, using bridge with basicObfuscation');
        pc = bridge.basicObfuscation('sockstortc', config);
      }

      return this.socksToRtc_.start(tcpServer, pc).then(
          (endpoint :net.Endpoint) => {
        log.info('SOCKS proxy listening on %1', endpoint);
        this.localGettingFromRemote = social.GettingState.GETTING_ACCESS;
        globals.metrics.increment('success');
        this.stateRefresh_();
        return endpoint;
      }).catch((e :Error) => {
        this.localGettingFromRemote = social.GettingState.NONE;
        globals.metrics.increment('failure');
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
