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

    public keyHash     :string
    public description :string;

    public bytesSent   :number = 0;
    public bytesReceived    :number = 0;
    // Current proxy access activity of the remote instance with respect to the
    // local instance of uProxy.
    public localGettingFromRemote = GettingState.NONE;
    public localSharingWithRemote = SharingState.NONE;

    // Used to prevent saving state while we have not yet loaded the state
    // from storage.
    private fulfillStorageLoad_ : () => void;

    public onceLoaded : Promise<void> = new Promise<void>((F, R) => {
      this.fulfillStorageLoad_ = F;
    }).then(() => {
      this.user.notifyUI();
    });


    public consent     :Consent.State = new Consent.State();
    // Whether or not there is a UI update (triggered by this.user.notifyUI())
    // scheduled to run in the next second.
    // Used by SocksToRtc & RtcToNet Handlers to make sure bytes sent and
    // received are only forwarded to the UI once every second.
    private isUIUpdatePending = false;

    // Number of milliseconds before timing out socksToRtc_.start
    public SOCKS_TO_RTC_TIMEOUT :number = 30000;
    private startupTimeout_ = null;

    private connection_ :Core.RemoteConnection = null;

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
        public instanceId :string,
        // The last instance handshake from the peer.  This data may be fresh
        // (over the wire) or recovered from disk (and stored in a
        // RemoteInstanceState, which subclasses InstanceHandshake).
        data        :InstanceHandshake) {
      this.connection_ = new Core.RemoteConnection(this.handleConnectionUpdate_);

      // Load consent state if it exists.  The consent state does not exist when
      // processing an initial instance handshake, only when restoring one from
      // storage.
      if (data) {
        this.update(data);
      }

      storage.load<RemoteInstanceState>(this.getStorePath())
          .then((state) => {
            this.restoreState(state);
            this.fulfillStorageLoad_();
          }).catch((e) => {
            // Instance not found in storage - we should fulfill the create
            // promise anyway as this is not an error.
            console.log('No stored state for instance ' + instanceId);
            this.fulfillStorageLoad_();
          });
    }

    private handleConnectionUpdate_ = (update :uProxy.Update, data?:any) => {
      switch (update) {
        case uProxy.Update.SIGNALLING_MESSAGE:
          var clientId = this.user.instanceToClient(this.instanceId);
          if (!clientId) {
            console.error('Could not find clientId for instance', this);
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
          console.warn('Received unexpected update from remote connection',
                       update, data);
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
        if (!this.consent.localGrantsAccessToRemote) {
          console.warn('Remote side attempted access without permission');
          return;
        }

        // Create a new rtcToNet object everytime there is an OFFER signal
        if(signalFromRemote['type'] == WebRtc.SignalType.OFFER) {
          this.connection_.startShare();
        }
      }

      this.connection_.handleSignal({
        type: type,
        data: signalFromRemote
      });
    }

    /**
     * Begin to use this remote instance as a proxy server, if permission is
     * currently granted.
     */
    public start = () :Promise<Net.Endpoint> => {
      if (!this.consent.remoteGrantsAccessToLocal) {
        console.warn('Lacking permission to proxy!');
        return Promise.reject('Lacking permission to proxy!');
      }

      // Cancel socksToRtc_ connection if start hasn't completed in 30 seconds.
      this.startupTimeout_ = setTimeout(() => {
        console.warn('Timing out socksToRtc_ connection');
        this.connection_.stopGet();
      }, this.SOCKS_TO_RTC_TIMEOUT);

      return this.connection_.startGet().then((endpoints :Net.Endpoint) => {
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
      this.connection_.stopGet();
    }

    /**
     * Update the information about this remote instance as a result of its
     * Instance Message.
     * Assumes that |data| actually belongs to this instance.
     */
    public update = (data :InstanceHandshake) => {
      // WARNING: |data| is UNTRUSTED, because it is often provided directly by
      // the remote peer.  Therefore, we MUST NOT make use of any consent
      // information that might be present.
      this.keyHash = data.keyHash;
      this.description = data.description;
      this.saveToStorage();
    }

    /**
     * Modify the consent for this instance, *locally*. (User clicked on one of
     * the consent buttons in the UI.) Sends updated consent bits to the
     * remote instance afterwards.
     */
    public modifyConsent = (action :Consent.UserAction) => {
      if (!Consent.handleUserAction(this.consent, action)) {
        console.warn('Invalid user action on consent!', this.consent, action);
        return;
      }
      // If remote is currently an active client, but user revokes access, also
      // stop the proxy session.
      if (Consent.UserAction.CANCEL_OFFER === action &&
          this.localSharingWithRemote == SharingState.SHARING_ACCESS) {
        this.connection_.stopShare();
      }
      // Send new consent bits to the remote client, and save to storage.
      this.sendConsent();
      this.saveToStorage();
      // Send an update to the UI.
      this.user.notifyUI();
    }

    /**
     * Send consent bits to re-synchronize consent with remote |instance|.
     * This is expected *after* receiving an instance notification for an
     * already existing instance.
     */
    public sendConsent = () => {
      this.onceLoaded.then(() => {
        if (this.user.isInstanceOnline(this.instanceId)) {
          this.user.sendInstanceHandshake(
              this.user.instanceToClient(this.instanceId),
              this.getConsentBits());
        }
      });
    }

    /**
     * Receive consent bits from the remote, and update consent values
     * accordingly.
     */
    public updateConsent = (bits:Consent.WireState) => {
      this.onceLoaded.then(() => {
        this.updateConsent_(bits);
      });
    }

    public updateConsent_ = (bits:Consent.WireState) => {

      var remoteWasGrantingAccess = this.consent.remoteGrantsAccessToLocal;
      var remoteWasRequestingAccess = this.consent.remoteRequestsAccessFromLocal;
      Consent.updateStateFromRemoteState(this.consent, bits);
      this.saveToStorage();
      // TODO: Make the UI update granular for just the consent, instead of the
      // entire parent User for this instance.
      this.user.notifyUI();

      // Fire a notification on the UI, if a state is different.
      // TODO: Determine if we should attach the instance id / decription to the
      // user name as part of the notification text.
      var note = null;
      if (this.consent.remoteGrantsAccessToLocal !== remoteWasGrantingAccess) {
        if (this.consent.remoteGrantsAccessToLocal
            && !this.consent.ignoringRemoteUserOffer) {
          // newly granted access
          if (this.consent.localRequestsAccessFromRemote) {
            note = ' granted you access.';
          } else {
            note = ' offered you access.';
          }
        } else {
          // newly revoked access
          if (!this.consent.ignoringRemoteUserOffer) {
            note = ' revoked your access.';
          }
        }
      }

      if (this.consent.remoteRequestsAccessFromLocal !== remoteWasRequestingAccess) {
        if (this.consent.remoteRequestsAccessFromLocal
            && !this.consent.ignoringRemoteUserRequest) {
          // newly requested/accepted access
          if (this.consent.localGrantsAccessToRemote) {
            note = ' has accepted your offer of access.';
          } else {
            note = ' is requesting access.';
          }
        }
        // No notification for cancelled requests.
      }

      if (note) {
        this.user.onceNameReceived.then((name :string) => {
          ui.showNotification(name + note);
        });
      }
    }

    /**
     * Return the pair of boolean consent bits indicating client and proxy
     * consent status, from the user's point of view. These bits will be sent on
     * the wire.
     */
    public getConsentBits = () :Consent.WireState => {
      return {
        isRequesting: this.consent.localRequestsAccessFromRemote,
        isOffering: this.consent.localGrantsAccessToRemote
      };
    }

    private saveToStorage = () => {
      return this.onceLoaded.then(() => {
        var state = this.currentState();
        return storage.save<RemoteInstanceState>(this.getStorePath(), state)
            .then((old) => {
          console.log('Saved instance ' + this.instanceId + ' to storage.');
        });
      });
    }

    /**
     * Get the raw attributes of the instance to be sent over to the UI or saved
     * to storage.
     */
    public currentState = () :RemoteInstanceState => {
      return cloneDeep({
        consent:     this.consent,
        description: this.description,
        keyHash:     this.keyHash
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
      this.consent = state.consent;
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
        consent:                this.consent,
        localGettingFromRemote: this.localGettingFromRemote,
        localSharingWithRemote: this.localSharingWithRemote,
        isOnline:               this.user.isInstanceOnline(this.instanceId),
        bytesSent:              this.bytesSent,
        bytesReceived:          this.bytesReceived
      });
    }

    public handleLogout = () => {
      if (this.connection_.localSharingWithRemote !== SharingState.NONE) {
        console.log('Closing rtcToNet_ for logout');
        this.connection_.stopShare();
      }

      if (this.connection_.localGettingFromRemote !== GettingState.NONE) {
        console.log('Stopping socksToRtc_ for logout');
        this.connection_.stopGet();
      }
    }

  }  // class Core.RemoteInstance

  export interface RemoteInstanceState {
    consent     :Consent.State;
    description :string;
    keyHash     :string;
  }

  // TODO: Implement obfuscation.
  export enum ObfuscationType {NONE, RANDOM1 }

}  // module Core
