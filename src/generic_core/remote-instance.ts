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
/// <reference path='util.ts' />

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
    private startupTimeout_ = null;

    public connection :Core.RemoteConnection = null;

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
      this.connection = new Core.RemoteConnection(this.handleConnectionUpdate_);

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
          this.clearTimeout_();
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
                           signalFromRemote:Object) => {
      if (uProxy.MessageType.SIGNAL_FROM_CLIENT_PEER === type) {
        // If the remote peer sent signal as the client, we act as server.
        if (!this.user.consent.localGrantsAccessToRemote) {
          log.warn('Remote side attempted access without permission');
          return;
        }

        // Create a new rtcToNet object everytime there is an OFFER signal
        if(signalFromRemote['type'] == WebRtc.SignalType.OFFER) {
          this.connection.startShare();
        }
      }

      this.connection.handleSignal({
        type: type,
        data: signalFromRemote
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
      this.startupTimeout_ = setTimeout(() => {
        log.warn('Timing out socksToRtc_ connection');
        this.connection.stopGet();
      }, this.SOCKS_TO_RTC_TIMEOUT);

      return this.connection.startGet().then((endpoints :Net.Endpoint) => {
        this.clearTimeout_();
        return endpoints;
      });
    }

    private clearTimeout_ = () => {
      if (this.startupTimeout_) {
        clearTimeout(this.startupTimeout_);
        this.startupTimeout_ = null;
      }
    }

    /**
     * Stop using this remote instance as a proxy server.
     */
    public stop = () : void => {
      this.connection.stopGet();
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

      // Get old values before updating this.wireConsentFromRemote
      // so we can see what changed.
      var oldIsOffering = this.wireConsentFromRemote.isOffering;
      var newIsOffering = bits.isOffering;

      // Update this remoteInstance.
      this.wireConsentFromRemote = bits;

      // Requesting access is part of consent from the user, however we may
      // need to update that based on the new bits.
      var oldIsRequesting = userConsent.remoteRequestsAccessFromLocal;
      this.user.updateRemoteRequestsAccessFromLocal();
      var newIsRequesting = userConsent.remoteRequestsAccessFromLocal;

      // Fire a notification on the UI, if a state is different.
      // TODO: Determine if we should attach the instance id / decription to the
      // user name as part of the notification text.
      var note = null;
      if (newIsOffering !== oldIsOffering &&
          !userConsent.ignoringRemoteUserOffer) {
        if (newIsOffering) {
          // newly granted access
          note = userConsent.localRequestsAccessFromRemote ?
              ' granted you access.' : ' offered you access.';
        } else {
          // newly revoked access
          note = ' revoked your access.';
        }
      }

      if (newIsRequesting && !oldIsRequesting &&
          !userConsent.ignoringRemoteUserRequest) {
        // newly requested/accepted access
        note = userConsent.localGrantsAccessToRemote ?
            ' has accepted your offer of access.' : ' is requesting access.';
      }

      if (note) {
        this.user.onceNameReceived.then((name :string) => {
          ui.showNotification(name + note);
        });
      }
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
      return cloneDeep({
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
      this.wireConsentFromRemote = state.wireConsentFromRemote;
    }

    /**
     * Returns a snapshot of a RemoteInstance's state for the UI. This includes
     * fields like isCurrentProxyClient that we don't want to save to storage.
     */
    public currentStateForUi = () :UI.Instance => {
      return cloneDeep({
        instanceId:             this.instanceId,
        description:            this.description,
        keyHash:                this.keyHash,
        localGettingFromRemote: this.localGettingFromRemote,
        localSharingWithRemote: this.localSharingWithRemote,
        isOnline:               this.user.isInstanceOnline(this.instanceId),
        bytesSent:              this.bytesSent,
        bytesReceived:          this.bytesReceived
      });
    }

    public handleLogout = () => {
      if (this.connection.localSharingWithRemote !== SharingState.NONE) {
        log.info('Closing rtcToNet_ for logout');
        this.connection.stopShare();
      }

      if (this.connection.localGettingFromRemote !== GettingState.NONE) {
        log.info('Stopping socksToRtc_ for logout');
        this.connection.stopGet();
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
