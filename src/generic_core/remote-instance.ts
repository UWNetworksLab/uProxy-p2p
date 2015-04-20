/**
 * remote-instance.ts
 *
 * This file defines the uProxy Instance class for remote installations. It
 * allows any pair of uProxy installations to speak to one another regarding
 * consent, proxying status, and any other signalling information.
 */
/// <reference path='../interfaces/instance.d.ts' />
/// <reference path='../interfaces/persistent.d.ts' />
/// <reference path='../webrtc/peerconnection.d.ts' />
/// <reference path='consent.ts' />
/// <reference path='core.ts' />
/// <reference path='remote-connection.ts' />
/// <reference path='social.ts' />
/// <reference path='../third_party/typings/lodash/lodash.d.ts' />

module Core {
  var log :Logging.Log = new Logging.Log('remote-instance');

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
  export class RemoteInstance implements Instance, Core.Persistent {

    public keyHash     :string;
    public description :string;

    public bytesSent   :number = 0;
    public bytesReceived    :number = 0;
    // Current proxy access activity of the remote instance with respect to the
    // local instance of uProxy.
    public localGettingFromRemote = GettingState.NONE;
    public localSharingWithRemote = SharingState.NONE;

    public wireConsentFromRemote :uProxy.ConsentWireState = {
      isRequesting: false,
      isOffering: false
    };

    // Used to prevent saving state while we have not yet loaded the state
    // from storage.
    private fulfillStorageLoad_ : () => void;

    public onceLoaded : Promise<void> = new Promise<void>((F, R) => {
      this.fulfillStorageLoad_ = F;
    }).then(() => {
      this.user.notifyUI();
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
    private startSocksToRtcTimeout_ = null;
    private startRtcToNetTimeout_ = null;

    private connection_ :Core.RemoteConnection = null;

    // Promise that tracks if an OFFER signal from a client peer is the next
    // signal for our remote connection to handle. When non-OFFER singals are
    // received before an OFFER, the promise is rejected. When an OFFER is
    // received, the promise is reset and fulfilled.
    private onceNextSignalIsOfferFromClientPeer_ :Promise<void> = null;
    private receivedOfferFromClientPeer_ :Function;
    private receivedOtherSignalFromClientPeer_ :Function;

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
        public user :Core.User,
        public instanceId :string) {
      this.connection_ = new Core.RemoteConnection(this.handleConnectionUpdate_);
      this.resetOnceNextSignalIsOfferFromClientPeer_();

      storage.load<RemoteInstanceState>(this.getStorePath())
          .then((state) => {
            this.restoreState(state);
            this.fulfillStorageLoad_();
          }).catch((e) => {
            // Instance not found in storage - we should fulfill the create
            // promise anyway as this is not an error.
            log.info('No stored state for instance', instanceId);
            this.fulfillStorageLoad_();
          });
    }

    private handleConnectionUpdate_ = (update :uProxy.Update, data?:any) => {
      switch (update) {
        case uProxy.Update.SIGNALLING_MESSAGE:
          var clientId = this.user.instanceToClient(this.instanceId);
          if (!clientId) {
            log.error('Could not find clientId for instance', this);
            return;
          }
          this.user.network.send(this.user, clientId, data);
          break;
        case uProxy.Update.STOP_GIVING:
          ui.update(uProxy.Update.STOP_GIVING_TO_FRIEND, this.instanceId);
          break;
        case uProxy.Update.START_GIVING:
          ui.update(uProxy.Update.START_GIVING_TO_FRIEND, this.instanceId);
          break;
        case uProxy.Update.STOP_GETTING:
          clearTimeout(this.startSocksToRtcTimeout_);
          ui.update(uProxy.Update.STOP_GETTING_FROM_FRIEND, {
            instanceId: this.instanceId,
            error: data
          });
          remoteProxyInstance = null;
          break;
        case uProxy.Update.STATE:
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

    /**
     * Handle signals sent along the signalling channel from the remote
     * instance, and pass it along to the relevant socks-rtc module.
     * TODO: spec
     * TODO: assuming that signal is valid, should we remove signal?
     * TODO: return a boolean on success/failure
     */
    public handleSignal = (type:uProxy.MessageType,
                           signalFromRemote:Object) :Promise<void> => {
      if (uProxy.MessageType.SIGNAL_FROM_CLIENT_PEER === type) {
        // If the remote peer sent signal as the client, we act as server.
        if (!this.user.consent.localGrantsAccessToRemote) {
          log.warn('Remote side attempted access without permission');
          return Promise.resolve<void>();
        }

        // Create a new rtcToNet object everytime there is an OFFER signal.
        if (signalFromRemote['type'] == WebRtc.SignalType.OFFER) {
          // TODO: Move the logic for resetting the onceSharerCreated promise inside
          // remote-connection.ts.
          this.connection_.resetSharerCreated();
          this.resetOnceNextSignalIsOfferFromClientPeer_();
          this.receivedOfferFromClientPeer_();
          this.startShare_();
        } else {
          this.receivedOtherSignalFromClientPeer_();
        }
        // Wait for the new rtcToNet instance to be created before you handle
        // additional messages from a client peer.
        return Promise.all([this.onceNextSignalIsOfferFromClientPeer_,
                            this.connection_.onceSharerCreated]).then(() => {
          this.connection_.handleSignal({
            type: type,
            data: signalFromRemote
          });
        }).catch(() => {
          log.info('Received signal ' + signalFromRemote['type'] +
              ' before receiving OFFER');
          return Promise.resolve<void>();
        });

        /*
        TODO: Uncomment when getter sends a cancel signal if socksToRtc closes while
        trying to connect. Something like:
        https://github.com/uProxy/uproxy-lib/tree/lucyhe-emitcancelsignal
        Issue: https://github.com/uProxy/uproxy/issues/1256

        } else if (signalFromRemote['type'] == WebRtc.SignalType.CANCEL_OFFER) {
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
      if (this.localSharingWithRemote === SharingState.NONE) {
        // Stop any existing sharing attempts with this instance.
        sharingStopped = Promise.resolve<void>();
      } else {
        sharingStopped = this.stopShare();
      }

      // Start sharing only after an existing connection is stopped.
      sharingStopped.then(() => {
        // Set timeout to close rtcToNet_ if start() takes too long.
        // Calling stopShare() at the end of the timeout makes the
        // assumption that our peer failed to start getting access.
        this.startRtcToNetTimeout_ = setTimeout(() => {
          log.warn('Timing out rtcToNet_ connection');
          ui.update(uProxy.Update.FRIEND_FAILED_TO_GET, this.user.name);
          this.stopShare();
        }, this.RTC_TO_NET_TIMEOUT);

        this.connection_.startShare().then(() => {
          clearTimeout(this.startRtcToNetTimeout_);
        }, () => {
          log.warn('Could not start sharing.');
          clearTimeout(this.startRtcToNetTimeout_);
        });
      });
    }

    public stopShare = () :Promise<void> => {
      if (this.localSharingWithRemote === SharingState.NONE) {
        log.warn('Cannot stop sharing while currently not sharing.');
        return Promise.resolve<void>();
      }

      if (this.localSharingWithRemote === SharingState.TRYING_TO_SHARE_ACCESS) {
        clearTimeout(this.startRtcToNetTimeout_);
      } else if (this.localSharingWithRemote === SharingState.SHARING_ACCESS) {
        // Since we're stopping sharing, discard the OFFER which initiated this
        // session.
        this.resetOnceNextSignalIsOfferFromClientPeer_();
      }
      return this.connection_.stopShare();
    }

    // Reset onceNextSignalIsOfferFromClientPeer_ to a promise that fulfills
    // when an OFFER is received and rejected if another signal is received
    // first.
    private resetOnceNextSignalIsOfferFromClientPeer_ = () => {
      this.onceNextSignalIsOfferFromClientPeer_ =
          new Promise<void>((fulfill, reject) => {
            this.receivedOfferFromClientPeer_ = fulfill;
            this.receivedOtherSignalFromClientPeer_ = reject;
          });
    }

    /**
     * Begin to use this remote instance as a proxy server, if permission is
     * currently granted.
     */
    public start = () :Promise<Net.Endpoint> => {
      if (!this.wireConsentFromRemote.isOffering) {
        log.warn('Lacking permission to proxy');
        return Promise.reject(Error('Lacking permission to proxy'));
      }

      // Cancel socksToRtc_ connection if start hasn't completed in 30 seconds.
      this.startSocksToRtcTimeout_ = setTimeout(() => {
        log.warn('Timing out socksToRtc_ connection');
        this.connection_.stopGet();
      }, this.SOCKS_TO_RTC_TIMEOUT);

      return this.connection_.startGet().then((endpoints :Net.Endpoint) => {
        clearTimeout(this.startSocksToRtcTimeout_);
        return endpoints;
      });
    }

    /**
     * Stop using this remote instance as a proxy server.
     */
    public stop = () : Promise<void> => {
      return this.connection_.stopGet();
    }

    /**
     * Update the information about this remote instance as a result of its
     * Instance Message.
     * Assumes that |data| actually belongs to this instance.
     */
    public update = (data :InstanceHandshake) : Promise<void> => {
      return this.onceLoaded.then(() => {
        this.keyHash = data.keyHash;
        this.description = data.description;
        this.updateConsentFromWire_(data.consent);
        this.saveToStorage();
      });
    }

    private updateConsentFromWire_ = (bits: uProxy.ConsentWireState) => {
      var userConsent = this.user.consent;

      // Update this remoteInstance.
      this.wireConsentFromRemote = bits;
      this.user.updateRemoteRequestsAccessFromLocal();
    }

    private saveToStorage = () => {
      return this.onceLoaded.then(() => {
        var state = this.currentState();
        return storage.save<RemoteInstanceState>(this.getStorePath(), state)
        .then((old) => {
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
        keyHash:               this.keyHash
      });
    }

    /**
     * Restore state from storage
     * if remote instance state was set, only overwrite fields
     * that correspond to local user action.
     */
    public restoreState = (state :RemoteInstanceState) => {
      this.description = state.description;
      this.keyHash = state.keyHash;
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
    public currentStateForUi = () :UI.Instance => {
      return {
        instanceId:             this.instanceId,
        description:            this.description,
        keyHash:                this.keyHash,
        localGettingFromRemote: this.localGettingFromRemote,
        localSharingWithRemote: this.localSharingWithRemote,
        isOnline:               this.user.isInstanceOnline(this.instanceId),
        bytesSent:              this.bytesSent,
        bytesReceived:          this.bytesReceived
      };
    }

    public handleLogout = () => {
      if (this.connection_.localSharingWithRemote !== SharingState.NONE) {
        log.info('Closing rtcToNet_ for logout');
        this.connection_.stopShare();
      }

      if (this.connection_.localGettingFromRemote !== GettingState.NONE) {
        log.info('Stopping socksToRtc_ for logout');
        this.connection_.stopGet();
      }
    }

  }  // class Core.RemoteInstance

  export interface RemoteInstanceState {
    wireConsentFromRemote :uProxy.ConsentWireState;
    description           :string;
    keyHash               :string;
  }

  // TODO: Implement obfuscation.
  export enum ObfuscationType {NONE, RANDOM1 }

}  // module Core
