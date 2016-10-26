/**
 * remote-connection.ts
 *
 * This file defines a class for a direct remote connection to another machine.
 * It handles the signaling channel between two peers, regardless of permission.
 */

import * as bridge from '../lib/bridge/bridge';
import * as constants from './constants';
import * as globals from './globals';
import * as logging from '../lib/logging/logging';
import * as net from '../lib/net/net.types';
import * as peerconnection from '../lib/webrtc/peerconnection';
import * as rc4 from '../lib/transformers/rc4';
import * as rtc_to_net from '../lib/rtc-to-net/rtc-to-net';
import * as social from '../interfaces/social';
import * as socks_to_rtc from '../lib/socks-to-rtc/socks-to-rtc';
import * as tcp from '../lib/net/tcp';
import * as uproxy_core_api from '../interfaces/uproxy_core_api';

declare var freedom: freedom.FreedomInModuleEnv;
const onlineMonitor = freedom['core.online']();

var PROXYING_SESSION_ID_LENGTH = 16;

// Generates a string of random letters suitable for use a proxying session ID.
var generateProxyingSessionId_ = (): string => {
  // Generates a random number between 97 and 122 inclusive, corresponding
  // to lowercase a and z:
  //  http://unicode.org/charts/PDF/U0000.pdf
  var a = 97, b = 122;
  var randomCharCode = (): number => {
    // TODO: use crypto, but that requires vulcanize to play with third_party
    return a + (Math.floor(Math.random() * (b - a)));
  };
  var letters: string[] = [];
  for (var i = 0; i < PROXYING_SESSION_ID_LENGTH; i++) {
    letters.push(String.fromCharCode(randomCharCode()));
  }
  return letters.join('');
}

// module Core {
  var log :logging.Log = new logging.Log('remote-connection');

  // Connections to remember, either because they're currently
  // connected or because they'll retry given the opportunity.
  let rememberedConnections : {[instanceId:string]: RemoteConnection} = {};

  export class RemoteConnection {

    // Number of milliseconds before timing out socksToRtc_.start
    private SOCKS_TO_RTC_TIMEOUT_ :number = 30000;
    // Ensure RtcToNet is only closed after SocksToRtc times out (i.e. finishes
    // trying to connect) by timing out rtcToNet_.start 15 seconds later than
    // socksToRtc_.start
    private RTC_TO_NET_TIMEOUT_ :number = this.SOCKS_TO_RTC_TIMEOUT_ + 15000;
    // Timeouts for when to abort starting up SocksToRtc and RtcToNet.
    private startSocksToRtcTimeout_ :NodeJS.Timer = null;
    private startRtcToNetTimeout_ :NodeJS.Timer = null;

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

    public activeEndpoint :net.Endpoint = null;

    // Unique ID of the most recent proxying attempt.
    private proxyingId_: string;

    // The remote version of the sharer that we're currently trying to get
    // access from.
    private currentGetRemoteVersion_: number;

    constructor(
      sendUpdate :(x :uproxy_core_api.Update, data?:Object) => void,
      private instanceId_:string,
      private userId_?:string,
      private portControl_?:freedom.PortControl.PortControl
    ) {
      this.sendUpdate_ = sendUpdate;
      this.resetSharerCreated();
      onlineMonitor.on('online', this.onOnline_);
    }

    private onOnline_ = () => {
      setTimeout(() => {
        if (this.localGettingFromRemote === social.GettingState.FAILED) {
          log.info('Back online in the failed state; restarting');
          this.startGet(this.currentGetRemoteVersion_);
        }
      }, 5000);  // 5 second delay for DHCP, etc.  TODO: Tune or remove.
    }

    public setSendUpdate =
        (sender:(x :uproxy_core_api.Update, data?:Object) => void) => {
      this.sendUpdate_ = sender;
    }

    private createSender_ = (type :social.PeerMessageType) => {
      return (signal :bridge.SignallingMessage) => {
        this.sendUpdate_(uproxy_core_api.Update.SIGNALLING_MESSAGE, {
          type: type,
          data: signal
        });
      }
    }

    // Handles signals received on the signalling channel from the remote peer.
    public handleSignal = (message:social.PeerMessage) :Promise<void> => {
      // TODO: forward messages from pre-bridge clients
      if ((<any>message.data).signals !== undefined) {
        return this.forwardSignal_(message.type, message.data);
      } else {
        return this.handleMetadataSignal_(
            <social.SignallingMetadata>message.data);
      }
    }

    private handleMetadataSignal_ = (
        message:social.SignallingMetadata) :Promise<void> => {
      if (message.proxyingId) {
        log.info('proxying session %1 initiated by remote peer', message.proxyingId);
        this.proxyingId_ = message.proxyingId;
      }
      return Promise.resolve();
    }

    // Forwards a signalling message to the RemoteConnection.
    private forwardSignal_ = (
        type:social.PeerMessageType,
        signal:Object)
        :Promise<void> => {
      if (social.PeerMessageType.SIGNAL_FROM_CLIENT_PEER === type
          && this.rtcToNet_) {
        this.rtcToNet_.handleSignalFromPeer(signal);
      } else if (social.PeerMessageType.SIGNAL_FROM_SERVER_PEER === type
                 && this.socksToRtc_) {
        this.socksToRtc_.handleSignalFromPeer(signal);
      } else {
        log.warn('Invalid signal: ', social.PeerMessageType[type]);
        return;
      }
    };

    public startShare = (remoteVersion:number) :Promise<void> => {
      if (this.rtcToNet_) {
        log.error('rtcToNet_ already exists');
        throw new Error('rtcToNet_ already exists');
      }

      var config :freedom.RTCPeerConnection.RTCConfiguration = {
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
        pc = bridge.best('rtctonet', config, this.portControl_);
      }

      // Set timeout to close rtcToNet_ if start() takes too long.
      // Calling stopShare() at the end of the timeout makes the
      // assumption that our peer failed to start getting access.
      this.startRtcToNetTimeout_ = setTimeout(() => {
        log.warn('Timing out rtcToNet_ connection');
        this.stopShare();
      }, this.RTC_TO_NET_TIMEOUT_);

      this.rtcToNet_ = new rtc_to_net.RtcToNet(this.userId_);
      this.rtcToNet_.start({
        allowNonUnicast: globals.settings.allowNonUnicast,
        reproxy: globals.settings.reproxy,
      }, pc);

      this.rtcToNet_.signalsForPeer.setSyncHandler(this.createSender_(social.PeerMessageType.SIGNAL_FROM_SERVER_PEER));
      this.rtcToNet_.bytesReceivedFromPeer.setSyncHandler(this.handleBytesReceived_);
      this.rtcToNet_.bytesSentToPeer.setSyncHandler(this.handleBytesSent_);
      this.rtcToNet_.statusUpdates.setSyncHandler(this.handleStatusUpdate_);

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
        return Promise.resolve();
      }

      this.localSharingWithRemote = social.SharingState.NONE;
      this.stateRefresh_();
      this.rtcToNet_.stop();
      return this.sharingReset_;
    }

    public startGet = (remoteVersion:number) :Promise<net.Endpoint> => {
      if (this.localGettingFromRemote !== social.GettingState.NONE &&
          this.localGettingFromRemote !== social.GettingState.FAILED) {
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

      this.proxyingId_ = generateProxyingSessionId_();
      log.info('initiating proxying session %1', this.proxyingId_);

      // Send the proxying session ID to the remote peer.
      var signal :social.SignallingMetadata = {
        proxyingId: this.proxyingId_
      }
      this.sendUpdate_(uproxy_core_api.Update.SIGNALLING_MESSAGE, {
        type: social.PeerMessageType.SIGNAL_FROM_CLIENT_PEER,
        data: signal
      });

      this.socksToRtc_ = new socks_to_rtc.SocksToRtc();

      this.socksToRtc_.bytesReceivedFromPeer.setSyncHandler(this.handleBytesReceived_);
      this.socksToRtc_.bytesSentToPeer.setSyncHandler(this.handleBytesSent_);

      if (this.localGettingFromRemote === social.GettingState.NONE) {
        this.localGettingFromRemote = social.GettingState.TRYING_TO_GET_ACCESS;
      } else {
        this.localGettingFromRemote = social.GettingState.RETRYING;
      }
      this.stateRefresh_();

      var tcpServer = new tcp.Server({
        address: '127.0.0.1',
        port: 0
      });

      var config :freedom.RTCPeerConnection.RTCConfiguration = {
        iceServers: globals.settings.stunServers
      };

      var pc: peerconnection.PeerConnection<Object>;

      this.currentGetRemoteVersion_ = remoteVersion;
      var localVersion = globals.effectiveMessageVersion();
      var commonVersion = Math.min(localVersion, remoteVersion);
      log.info('lowest shared client version is %1 (me: %2, peer: %3)',
          commonVersion, localVersion, remoteVersion);
      // See globals.ts for a description of each version.
      switch (commonVersion) {
        case constants.MESSAGE_VERSIONS.PRE_BRIDGE:
          log.debug('using old peerconnection');
          pc = new peerconnection.PeerConnectionClass(
            freedom['core.rtcpeerconnection'](config),
            'sockstortc');
          break;
        case constants.MESSAGE_VERSIONS.BRIDGE:
          log.debug('using bridge without obfuscation');
          pc = bridge.preObfuscation('sockstortc', config, this.portControl_);
          break;
        case constants.MESSAGE_VERSIONS.CAESAR:
          log.debug('using bridge with caesar obfuscation');
          pc = bridge.basicObfuscation('sockstortc', config, this.portControl_);
          break;
        case constants.MESSAGE_VERSIONS.HOLOGRAPHIC_ICE:
        case constants.MESSAGE_VERSIONS.ENCRYPTED_SIGNALS:
          // Since nothing changed at the peerconnection layer between
          // HOLOGRAPHIC_ICE and ENCRYPTED_SIGNALS, we can safely
          // fall through.
          log.debug('using holographic ICE with caesar obfuscation');
          pc = bridge.holographicIceOnly('sockstortc', config, this.portControl_);
          break;
        default:
          log.debug('using holographic ICE with RC4 obfuscation');
          pc = bridge.holographicIceOnly('sockstortc', config, this.portControl_, {
            name: 'rc4',
            config: JSON.stringify(rc4.randomConfig())
          });
        }

        globals.metrics.increment('attempt');

      // Cancel socksToRtc_ connection if start hasn't completed in 30 seconds.
      this.startSocksToRtcTimeout_ = setTimeout(() => {
        log.warn('Timing out socksToRtc_ connection');
        this.socksToRtc_.stop();
        this.onConnectFailed_();
      }, this.SOCKS_TO_RTC_TIMEOUT_);

      const start = this.socksToRtc_.start(tcpServer, pc).then((endpoint :net.Endpoint) => {
        log.info('SOCKS proxy listening on %1', endpoint);
        this.localGettingFromRemote = social.GettingState.GETTING_ACCESS;
        globals.metrics.increment('success');
        this.stateRefresh_();
        this.activeEndpoint = endpoint;
        return endpoint;
      }).catch((e :Error) => {
        this.onConnectFailed_();
        return Promise.reject(Error('Could not start proxy'));
      });

      // Ugh, this needs to be called after start.
      this.socksToRtc_.signalsForPeer.setSyncHandler(
          this.createSender_(social.PeerMessageType.SIGNAL_FROM_CLIENT_PEER));

      // onceStopped isn't defined until after calling start().
      this.socksToRtc_.onceStopped.then(() => {
        // Stopped event is only considered an error if the user had been
        // getting access and we hadn't called this.socksToRtc_.stop
        // If there is an error when trying to start proxying, and a stopped
        // event is fired, an error will be displayed as a result of the start
        // promise rejecting.

        let isError = social.GettingState.NONE !== this.localGettingFromRemote &&
            social.GettingState.TRYING_TO_GET_ACCESS !== this.localGettingFromRemote;

        this.localGettingFromRemote = isError ? social.GettingState.FAILED :
            social.GettingState.NONE;
        this.bytesSent_ = 0;
        this.bytesReceived_ = 0;
        this.stateRefresh_();
        this.socksToRtc_ = null;
        this.activeEndpoint = null;

        if (isError) {
          // Check if we're online.  If we are, the error-stop may have been
          // due to a transient condition that has already resolved, so
          // trigger a retry (if we're still in the FAILED state).  This means
          // that while online, broken connections will retry forever.
          onlineMonitor.isOnline().then((online:boolean) => {
            if (online) {
              this.onOnline_();
            }
          })
        }
      });

      return start;
    }

    private onConnectFailed_ = () : void => {
      if (this.localGettingFromRemote === social.GettingState.TRYING_TO_GET_ACCESS ||
          this.localGettingFromRemote === social.GettingState.NONE) {
        this.localGettingFromRemote = social.GettingState.NONE;
      } else {
        this.localGettingFromRemote = social.GettingState.FAILED;
      }
      this.socksToRtc_ = null;
      this.stateRefresh_();
    }

    public stopGet = () :Promise<void> => {
      if (this.localGettingFromRemote === social.GettingState.NONE) {
        log.warn('Cannot stop proxying when neither proxying nor trying to proxy.');
        return;
      }
      globals.metrics.increment('stop');
      this.localGettingFromRemote = social.GettingState.NONE;
      this.stateRefresh_();
      if (this.socksToRtc_) {
        return this.socksToRtc_.stop();
      }
      return Promise.resolve();
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

    private handleStatusUpdate_ = (status :rtc_to_net.Status) => {
      switch(status) {
        case rtc_to_net.Status.REPROXY_ERROR:
          this.sendUpdate_(uproxy_core_api.Update.REPROXY_ERROR, null);
          break;
        case rtc_to_net.Status.REPROXY_WORKING:
          this.sendUpdate_(uproxy_core_api.Update.REPROXY_WORKING, null);
          break;
        default:
          log.warn('Received unrecognized status update from RtcToNet: %1', status);
      }
    }

    private stateRefresh_ = () => {
      if (this.localGettingFromRemote !== social.GettingState.NONE ||
          this.localSharingWithRemote !== social.SharingState.NONE) {
        rememberedConnections[this.instanceId_] = this;
      } else {
        delete rememberedConnections[this.instanceId_];
      }
      if (this.localGettingFromRemote !== social.GettingState.TRYING_TO_GET_ACCESS &&
          this.localGettingFromRemote !== social.GettingState.RETRYING) {
        clearTimeout(this.startSocksToRtcTimeout_);
      }
      if (this.localSharingWithRemote !== social.SharingState.TRYING_TO_SHARE_ACCESS) {
        clearTimeout(this.startRtcToNetTimeout_);
      }
      this.sendUpdate_(uproxy_core_api.Update.STATE, this.getCurrentState());
    }

    public getCurrentState = () :uproxy_core_api.ConnectionState => {
      return {
        bytesSent: this.bytesSent_,
        bytesReceived: this.bytesReceived_,
        localGettingFromRemote: this.localGettingFromRemote,
        localSharingWithRemote: this.localSharingWithRemote,
        activeEndpoint: this.activeEndpoint,
        proxyingId: this.proxyingId_,
      };
    }

    public getProxyingId = () : string => {
      return this.proxyingId_;
    }
  }

export function getOrCreateRemoteConnection (
    sendUpdate :(x:uproxy_core_api.Update, data?:Object) => void,
    instanceId:string,
    userId?:string,
    portControl?:freedom.PortControl.PortControl) :RemoteConnection {
  if (instanceId in rememberedConnections) {
    let connection = rememberedConnections[instanceId];
    connection.setSendUpdate(sendUpdate);
    return connection;
  }
  return new RemoteConnection(sendUpdate, instanceId, userId, portControl);
}
// }
