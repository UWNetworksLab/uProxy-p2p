/**
 * remote-instance.ts
 *
 * This file defines the uProxy Instance class for remote installations. It
 * allows any pair of uProxy installations to speak to one another regarding
 * consent, proxying status, and any other signalling information.
 */

/// <reference path='../../../third_party/typings/lodash/lodash.d.ts' />
/// <reference path='../../../third_party/freedom-typings/pgp.d.ts' />

import consent = require('./consent');
import globals = require('./globals');
import logging = require('../../../third_party/uproxy-lib/logging/logging');
import net = require('../../../third_party/uproxy-lib/net/net.types');
import remote_connection = require('./remote-connection');
import remote_user = require('./remote-user');
import bridge = require('../../../third_party/uproxy-lib/bridge/bridge');
import signals = require('../../../third_party/uproxy-lib/webrtc/signals');
import social = require('../interfaces/social');
import ui_connector = require('./ui_connector');
import uproxy_core_api = require('../interfaces/uproxy_core_api');
import user_interface = require('../interfaces/ui');
import _ = require('lodash');
import arraybuffers = require('../../../third_party/uproxy-lib/arraybuffers/arraybuffers');

import storage = globals.storage;
import ui = ui_connector.connector;
import pgp = globals.pgp;

import Persistent = require('../interfaces/persistent');

// Keep track of the current remote instance who is acting as a proxy server
// for us.

// module Core {
  var log :logging.Log = new logging.Log('remote-instance');

  /**
   * RemoteInstance - represents a remote uProxy installation.
   *
   * These remote instances are semi-permanent, and belong only to one user.
   * They can be online or offline depending on if they are associated with a
   * client. Interface-wise, this class is only aware of its parent User, and
   * does not have any direct interaction with the network it belongs to.
   *
   * There are two pathways to modifying the consent of this remote instance.
   * - Locally, via a user command from the UI.
   * - Remotely, via consent bits sent over the wire by a friend.
   */
  export class RemoteInstance implements Persistent {

    public publicKey   :string;
    public keyVerified :boolean = false;
    public description :string;

    // Client version of the remote peer.
    public messageVersion :number;

    public bytesSent   :number = 0;
    public bytesReceived    :number = 0;
    // Current proxy access activity of the remote instance with respect to the
    // local instance of uProxy.
    public localGettingFromRemote = social.GettingState.NONE;
    public localSharingWithRemote = social.SharingState.NONE;

    public wireConsentFromRemote :social.ConsentWireState = {
      isRequesting: false,
      isOffering: false
    };

    // Used to prevent saving state while we have not yet loaded the state
    // from storage.
    private fulfillStorageLoad_ : () => void;

    public onceLoaded : Promise<void> = new Promise<void>((F, R) => {
      this.fulfillStorageLoad_ = F;
    });

    // Whether or not there is a UI update (triggered by this.user.notifyUI())
    // scheduled to run in the next second.
    // Used by SocksToRtc & RtcToNet Handlers to make sure bytes sent and
    // received are only forwarded to the UI once every second.
    private isUIUpdatePending = false;

    // Number of milliseconds before timing out socksToRtc_.start
    public SOCKS_TO_RTC_TIMEOUT :number = 30000;
    // Ensure RtcToNet is only closed after SocksToRtc times out (i.e. finishes
    // trying to connect) by timing out rtcToNet_.start 15 seconds later than
    // socksToRtc_.start
    public RTC_TO_NET_TIMEOUT :number = this.SOCKS_TO_RTC_TIMEOUT + 15000;
    // Timeouts for when to abort starting up SocksToRtc and RtcToNet.
    // TODO: why are these not in remote-connection?
    private startSocksToRtcTimeout_ :number = null;
    private startRtcToNetTimeout_ :number = null;

    private connection_ :remote_connection.RemoteConnection = null;

    /**
     * Construct a Remote Instance as the result of receiving an instance
     * handshake, or loadig from storage. Typically, instances are initialized
     * with the lowest consent values.
     * Users of RemoteInstance should call the static .create method
     * rather than directly calling this, in order to get a RemoteInstance
     * that has been loaded from storage.
     */
    constructor(
        // The User which this instance belongs to.
        public user :remote_user.User,
        public instanceId :string) {
      this.connection_ = new remote_connection.RemoteConnection(
          this.handleConnectionUpdate_, this.user.userId, globals.portControl);

      storage.load<RemoteInstanceState>(this.getStorePath())
          .then((state:RemoteInstanceState) => {
            this.restoreState(state);
            this.fulfillStorageLoad_();
          }).catch((e:Error) => {
            // Instance not found in storage - we should fulfill the create
            // promise anyway as this is not an error.
            log.info('No stored state for instance', instanceId);
            this.fulfillStorageLoad_();
          });
    }

    private handleConnectionUpdate_ = (update :uproxy_core_api.Update, data?:any) => {
      log.debug('connection update: %1', uproxy_core_api.Update[update]);
      switch (update) {
        case uproxy_core_api.Update.SIGNALLING_MESSAGE:
          var clientId = this.user.instanceToClient(this.instanceId);
          if (!clientId) {
            log.error('Could not find clientId for instance', this);
            return;
          }
          if (typeof this.publicKey !== 'undefined') {
            var arrayBufferData =
                arraybuffers.stringToArrayBuffer(JSON.stringify(data.data));
            pgp.signEncrypt(arrayBufferData, this.publicKey)
                .then((cipherData:ArrayBuffer) => {
                  return pgp.armor(cipherData);
                }).then((cipherText :string) => {
                  data.data = cipherText;
                  this.user.network.send(this.user, clientId, data);
                }).catch((e) => {
                  log.error('Error encrypting message ', e);
                });
          } else {
            this.user.network.send(this.user, clientId, data);
          }
          break;
        case uproxy_core_api.Update.STOP_GIVING:
          ui.update(uproxy_core_api.Update.STOP_GIVING_TO_FRIEND, this.instanceId);
          break;
        case uproxy_core_api.Update.START_GIVING:
          ui.update(uproxy_core_api.Update.START_GIVING_TO_FRIEND, this.instanceId);
          break;
        case uproxy_core_api.Update.STOP_GETTING:
          clearTimeout(this.startSocksToRtcTimeout_);
          ui.update(uproxy_core_api.Update.STOP_GETTING_FROM_FRIEND, {
            instanceId: this.instanceId,
            error: data
          });
          break;
        case uproxy_core_api.Update.STATE:
          this.bytesSent = data.bytesSent;
          this.bytesReceived = data.bytesReceived;
          this.localGettingFromRemote = data.localGettingFromRemote;
          this.localSharingWithRemote = data.localSharingWithRemote;
          this.user.notifyUI();
          break;
        default:
          log.warn('Received unexpected update from remote connection', {
            update: update,
            data: data
          });
      }
    }

    /**
     * Obtain the prefix for all storage keys associated with this Instance.
     * Since the parent User's userId may change, only store the userId.
     */
    public getStorePath = () => {
      return this.user.getLocalInstanceId() + '/' + this.instanceId;
    }

    public isSharing = () => {
      return this.localSharingWithRemote === social.SharingState.SHARING_ACCESS;
    }

    /**
     * Handle signals sent along the signalling channel from the remote
     * instance, and pass it along to the relevant socks-rtc module.
     * TODO: spec
     * TODO: assuming that signal is valid, should we remove signal?
     * TODO: return a boolean on success/failure
     */
    public handleSignal = (msg :social.VersionedPeerMessage) :Promise<void> => {

      if (msg.version < 5) {
        return this.handleDecryptedSignal_(msg.type, msg.version, msg.data);
      } else {
        return pgp.dearmor(<string>msg.data).then((cipherData :ArrayBuffer) => {
          return pgp.verifyDecrypt(cipherData, this.publicKey);
        }).then((result :VerifyDecryptResult) => {
          var decryptedSignal =
              JSON.parse(arraybuffers.arrayBufferToString(result.data));
          return this.handleDecryptedSignal_(msg.type, msg.version, decryptedSignal);
        }).catch((e) => {
          log.error('Error decrypting message ', e);
        });
      }
    }

    private handleDecryptedSignal_ = (
        type:social.PeerMessageType,
        messageVersion:number,
        signalFromRemote:bridge.SignallingMessage) : Promise<void> => {
      if (social.PeerMessageType.SIGNAL_FROM_CLIENT_PEER === type) {
        // If the remote peer sent signal as the client, we act as server.
        if (!this.user.consent.localGrantsAccessToRemote) {
          log.warn('Remote side attempted access without permission');
          return Promise.resolve<void>();
        }

        // Create a new RtcToNet instance each time a new round of client peer
        // messages begins. The type field check is so pre-bridge,
        // MESSAGE_VERSION = 1, clients can initiate.
        // TODO: have RemoteConnection do this, based on SignallingMetadata
        if (signalFromRemote.first ||
            ((<signals.Message>signalFromRemote).type === signals.Type.OFFER)) {
          this.connection_.resetSharerCreated();
          this.startShare_();
        }

        // Wait for the new rtcToNet instance to be created before you handle
        // additional messages from a client peer.
        return this.connection_.onceSharerCreated.then(() => {
          this.connection_.handleSignal({
            type: type,
            data: signalFromRemote
          });
        });

        /*
        TODO: Uncomment when getter sends a cancel signal if socksToRtc closes while
        trying to connect. Something like:
        https://github.com/uProxy/uproxy-lib/tree/lucyhe-emitcancelsignal
        Issue: https://github.com/uProxy/uproxy/issues/1256

        } else if (signalFromRemote['type'] == signals.Type.CANCEL_OFFER) {
          this.stopShare();
          return;
        }
        */
      }

      this.connection_.handleSignal({
        type: type,
        data: signalFromRemote
      });
      return Promise.resolve<void>();
    }

    /**
      * When our peer sends us a signal that they'd like to be a client,
      * we should try to start sharing.
      */
    private startShare_ = () : void => {
      var sharingStopped :Promise<void>;
      if (this.localSharingWithRemote === social.SharingState.NONE) {
        // Stop any existing sharing attempts with this instance.
        sharingStopped = Promise.resolve<void>();
      } else {
        // Implies that the SharingState is TRYING_TO_SHARE_ACCESS because
        // the client peer should never be able to try to get if they are
        // already getting (and this sharer is already sharing).
        sharingStopped = this.stopShare();
      }

      // Start sharing only after an existing connection is stopped.
      sharingStopped.then(() => {
        // Set timeout to close rtcToNet_ if start() takes too long.
        // Calling stopShare() at the end of the timeout makes the
        // assumption that our peer failed to start getting access.
        this.startRtcToNetTimeout_ = setTimeout(() => {
          log.warn('Timing out rtcToNet_ connection');
          // Tell the UI that sharing failed. It will show a toast.
          // TODO: have RemoteConnection do this
          ui.update(uproxy_core_api.Update.FAILED_TO_GIVE, {
            name: this.user.name,
            proxyingId: this.connection_.getProxyingId()
          });
          this.stopShare();
        }, this.RTC_TO_NET_TIMEOUT);

        this.connection_.startShare(this.messageVersion).then(() => {
          clearTimeout(this.startRtcToNetTimeout_);
        }, () => {
          log.warn('Could not start sharing.');
          clearTimeout(this.startRtcToNetTimeout_);
        });
      });
    }

    public stopShare = () :Promise<void> => {
      if (this.localSharingWithRemote === social.SharingState.NONE) {
        log.warn('Cannot stop sharing while currently not sharing.');
        return Promise.resolve<void>();
      }

      if (this.localSharingWithRemote === social.SharingState.TRYING_TO_SHARE_ACCESS) {
        clearTimeout(this.startRtcToNetTimeout_);
      }
      return this.connection_.stopShare();
    }

    /**
     * Begin to use this remote instance as a proxy server, if permission is
     * currently granted.
     */
    public start = () :Promise<net.Endpoint> => {
      if (!this.wireConsentFromRemote.isOffering) {
        log.warn('Lacking permission to proxy');
        return Promise.reject(Error('Lacking permission to proxy'));
      }

      // Cancel socksToRtc_ connection if start hasn't completed in 30 seconds.
      this.startSocksToRtcTimeout_ = setTimeout(() => {
        log.warn('Timing out socksToRtc_ connection');
        // Tell the UI that sharing failed. It will show a toast.
        // TODO: have RemoteConnection do this

        this.connection_.stopGet();
      }, this.SOCKS_TO_RTC_TIMEOUT);

      var startGetAttempt :Promise<net.Endpoint> = this.connection_
          .startGet(this.messageVersion).then((endpoints :net.Endpoint) => {
        clearTimeout(this.startSocksToRtcTimeout_);
        return endpoints;
      });
      startGetAttempt.catch((e) => {
        ui.update(uproxy_core_api.Update.FAILED_TO_GET, {
          name: this.user.name,
          proxyingId: this.connection_.getProxyingId()
        });
      });
      return startGetAttempt;
    }

    /**
     * Stop using this remote instance as a proxy server.
     */
    public stop = () :Promise<void> => {
      return this.connection_.stopGet();
    }

    /**
     * Update the information about this remote instance as a result of its
     * Instance Message.
     * Assumes that |data| actually belongs to this instance.
     */
    public update = (data:social.InstanceHandshake,
        messageVersion:number) :Promise<void> => {
      return this.onceLoaded.then(() => {
        if (typeof this.publicKey === 'undefined' || !this.keyVerified) {
          this.publicKey = data.publicKey;
        }
        this.description = data.description;
        this.updateConsentFromWire_(data.consent);
        this.messageVersion = messageVersion;
        this.saveToStorage();
      });
    }

    private updateConsentFromWire_ = (bits :social.ConsentWireState) => {
      var userConsent = this.user.consent;

      // Update this remoteInstance.
      this.wireConsentFromRemote = bits;
      this.user.updateRemoteRequestsAccessFromLocal();
    }

    private saveToStorage = () => {
      return this.onceLoaded.then(() => {
        var state = this.currentState();
        return storage.save(this.getStorePath(), state)
        .then(() => {
          log.debug('Saved instance to storage', this.instanceId);
        }).catch((e) => {
          log.error('Failed saving instance to storage', this.instanceId, e.stack);
        });
      });
    }

    /**
     * Get the raw attributes of the instance to be sent over to the UI or saved
     * to storage.
     */
    public currentState = () :RemoteInstanceState => {
      return _.cloneDeep({
        wireConsentFromRemote: this.wireConsentFromRemote,
        description:           this.description,
        publicKey:             this.publicKey,
        keyVerified:           this.keyVerified
      });
    }

    /**
     * Restore state from storage
     * if remote instance state was set, only overwrite fields
     * that correspond to local user action.
     */
    public restoreState = (state :RemoteInstanceState) => {
      this.description = state.description;
      if (typeof state.publicKey !== 'undefined') {
        this.publicKey = state.publicKey;
      }
      if (typeof state.keyVerified !== 'undefined') {
        this.keyVerified = state.keyVerified;
      }
      if (state.wireConsentFromRemote) {
        this.wireConsentFromRemote = state.wireConsentFromRemote
      } else {
        log.error('Failed to load wireConsentFromRemote for instance ' +
            this.instanceId);
      }
    }

    /**
     * Returns a snapshot of a RemoteInstance's state for the UI. This includes
     * fields like isCurrentProxyClient that we don't want to save to storage.
     */
    // TODO: bad smell: remote-instance should not need to know the structure of
    // UI message data. Maybe rename to |getInstanceData|?
    public currentStateForUi = () :social.InstanceData => {
      return {
        instanceId:             this.instanceId,
        description:            this.description,
        localGettingFromRemote: this.localGettingFromRemote,
        localSharingWithRemote: this.localSharingWithRemote,
        isOnline:               this.user.isInstanceOnline(this.instanceId),
        bytesSent:              this.bytesSent,
        bytesReceived:          this.bytesReceived
      };
    }

    public handleLogout = () => {
      if (this.connection_.localSharingWithRemote !== social.SharingState.NONE) {
        log.info('Closing rtcToNet_ for logout');
        this.connection_.stopShare();
      }

      if (this.connection_.localGettingFromRemote !== social.GettingState.NONE) {
        log.info('Stopping socksToRtc_ for logout');
        this.connection_.stopGet();
      }
    }

  }  // class remote_instance.RemoteInstance

  export interface RemoteInstanceState {
    wireConsentFromRemote :social.ConsentWireState;
    description           :string;
    publicKey             :string;
    keyVerified           :boolean
  }

  // TODO: Implement obfuscation.
  export enum ObfuscationType {NONE, RANDOM1 }

// }  // module Core
