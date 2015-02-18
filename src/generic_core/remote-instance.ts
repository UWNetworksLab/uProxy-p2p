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
/// <reference path='../rtc-to-net/rtc-to-net.ts' />
/// <reference path='../socks-to-rtc/socks-to-rtc.ts' />
/// <reference path='auth.ts' />
/// <reference path='consent.ts' />
/// <reference path='core.ts' />
/// <reference path='remote-transport.ts' />
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

    // Used to prevent saving state while we have not yet loaded the state
    // from storage.
    private fulfillStorageLoad_ : () => void;

    private onceLoaded_ : Promise<void> = new Promise<void>((F, R) => {
      this.fulfillStorageLoad_ = F;
    });


    public consent     :Consent.State = new Consent.State();
    // Current proxy access activity of the remote instance with respect to the
    // local instance of uProxy.
    public localGettingFromRemote = GettingState.NONE;
    public localSharingWithRemote = SharingState.NONE;
    private transport  :Transport;
    // Whether or not there is a UI update (triggered by this.user.notifyUI())
    // scheduled to run in the next second.
    // Used by SocksToRtc & RtcToNet Handlers to make sure bytes sent and
    // received are only forwarded to the UI once every second.
    private isUIUpdatePending = false;

    // Number of milliseconds before timing out socksToRtc_.start
    public SOCKS_TO_RTC_TIMEOUT :number = 30000;

    // The configuration used to setup peer-connections. This should be
    // available under advanced options.
    public socksRtcPcConfig :freedom_RTCPeerConnection.RTCConfiguration = {
      iceServers: core.globalSettings.stunServers
    };
    public rtcNetPcConfig :freedom_RTCPeerConnection.RTCConfiguration = {
      iceServers: core.globalSettings.stunServers
    };
    public rtcNetProxyConfig :RtcToNet.ProxyConfig = {
      allowNonUnicast: false
    };

    // If set, this is the localhost socks server that is receiving
    // connections and sending them to the peer.
    private socksToRtc_ :SocksToRtc.SocksToRtc = null;

    // If set, this is the WebRtc peer-connection that is receiving requests
    // from the peer and handling them by proxying them to the internet.
    private rtcToNet_ :RtcToNet.RtcToNet = null;

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

    /**
     * Obtain the prefix for all storage keys associated with this Instance.
     * Since the parent User's userId may change, only store the userId.
     */
    public getStorePath = () => {
      return this.user.getLocalInstanceId() + '/' + this.instanceId;
    }

    /**
     * Send a message to this instance. Queues messages if the instance is
     * currently not reachable. (Its client went offline, and a new one may show
     * up in the future)
     *
     * TODO: Implement queueing using promises.
     * First we need to know that the social API's sendMessage propogates error
     * messages.
     */
    public send = (msg:uProxy.Message) => {
      // The parent User is responsible for mapping the instanceId to the
      // correct clientId so that the social network can pass the message along.
      this.user.send(this.instanceId, msg);
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
      switch (type) {
        case uProxy.MessageType.SIGNAL_FROM_CLIENT_PEER:
          // If the remote peer sent signal as the client, we act as server.
          if (!this.consent.localGrantsAccessToRemote) {
            console.warn('Remote side attempted access without permission');
            return;
          }

          // Create a new rtcToNet object everytime there is an OFFER signal
          if(signalFromRemote['type'] == WebRtc.SignalType.OFFER) {
            // TODO: make this into a separate function
            this.rtcToNet_ = new RtcToNet.RtcToNet(
                this.rtcNetPcConfig, this.rtcNetProxyConfig);
            this.rtcToNet_.onceClosed.then(() => {
              console.log('rtcToNet_.onceClosed called');
              this.localSharingWithRemote = SharingState.NONE;
              ui.update(uProxy.Update.STOP_GIVING_TO_FRIEND, this.instanceId);
              this.rtcToNet_ = null;
              this.bytesSent = 0;
              this.bytesReceived = 0;
              this.user.notifyUI();
              // TODO: give each notification a real data structure and id,
              // and allow the user select what notifications they get.
              ui.showNotification(this.user.name + ' stopped proxying through you');
            });
            this.rtcToNet_.signalsForPeer.setSyncHandler((signal) => {
              this.send({
                type: uProxy.MessageType.SIGNAL_FROM_SERVER_PEER,
                data: signal
              });
            });
            // When bytes are sent to or received from the client, notify the
            // UI about the increase in data exchanged. Increment the bytes
            // sent/received variables in real time, but use a timer to control
            // when notifyUI() is called.
            this.rtcToNet_.bytesReceivedFromPeer
                .setSyncHandler((numBytes:number) => {
              this.bytesReceived += numBytes;
              this.updateBytesInUI();
            });
            this.rtcToNet_.bytesSentToPeer
                .setSyncHandler((numBytes:number) => {
              this.bytesSent += numBytes;
              this.updateBytesInUI();
            });
            this.rtcToNet_.onceReady.then(() => {
              this.localSharingWithRemote = SharingState.SHARING_ACCESS;
              ui.update(uProxy.Update.START_GIVING_TO_FRIEND, this.instanceId);
              this.user.notifyUI();
            }).catch((e) => {
              console.error('error start rtcToNet: ', e);
              this.rtcToNet_ = null;
            });
          }
          if (!this.rtcToNet_) {
            // rtcToNet_ should be created when we receive an OFFER message
            console.warn('Received SIGNAL_FROM_CLIENT_PEER without OFFER',
                signalFromRemote);
            return;
          }
          this.rtcToNet_.handleSignalFromPeer(
              <WebRtc.SignallingMessage>signalFromRemote);
          break;

        case uProxy.MessageType.SIGNAL_FROM_SERVER_PEER:
          if (!this.socksToRtc_) {
            console.error('Race condition! Received signal from server but ' +
                'local SocksToRtc does not exist.');
            return;
          }
          // If the remote peer sent signal as the server, we act as client.
          this.socksToRtc_.handleSignalFromPeer(
              <WebRtc.SignallingMessage>signalFromRemote);
          break;

        default:
          console.warn('Invalid signal! ' + uProxy.MessageType[type]);
          return
      }
    }

    /**
     * Begin to use this remote instance as a proxy server, if permission is
     * currently granted.
     */
    public start = () :Promise<Net.Endpoint> => {
      if (!this.consent.remoteGrantsAccessToLocal) {
        console.warn('Lacking permission to proxy!');
        return Promise.reject('Lacking permission to proxy!');
      } else if (this.localGettingFromRemote !== GettingState.NONE) {
        // This should not happen. If it does, something else is broken. Still, we
        // continue to actually proxy through the instance.
        console.warn('Already proxying through ' + this.instanceId);
        return Promise.reject('Already proxying through ' + this.instanceId);
      }
      // TODO: sync properly between the extension and the app on proxy settings
      // rather than this cooincidentally the same data.

      // Speak with socks-rtc to start the connection.
      // The localhost host:port will be taken care of by WebRTC. The peerId is
      // utilized to set the local and remote descriptions on the
      // RTCPeerConnection.
      if (null != this.socksToRtc_) {
        console.warn('socksToRtc_ already exists for remoteInstance');
      }
      // Tell SocksToRtc to use a localhost SOCKS server.
      var endpoint :Net.Endpoint = {
          address: '127.0.0.1',
          port: 0
      }

      this.socksToRtc_ = new SocksToRtc.SocksToRtc();
      this.socksToRtc_.on('signalForPeer', (signal) => {
        this.send({
          type: uProxy.MessageType.SIGNAL_FROM_CLIENT_PEER,
          data: signal
        });
      });

      // When bytes are sent to or received through the proxy, notify the
      // UI about the increase in data exchanged. Increment the bytes
      // sent/received variables in real time, but use a timer to control
      // when notifyUI() is called.
      this.socksToRtc_.on('bytesReceivedFromPeer', (numBytes:number) => {
        this.bytesReceived += numBytes;
        this.updateBytesInUI();
      });
      this.socksToRtc_.on('bytesSentToPeer', (numBytes:number) => {
        this.bytesSent += numBytes;
        this.updateBytesInUI();
      });

      this.socksToRtc_.on('stopped', () => {
        console.log('socksToRtc_.once(\'stopped\', ...) called');
        // Stopped event is only considered an error if the user had been
        // getting access and we hadn't called this.socksToRtc_.stop
        // If there is an error when trying to start proxying, and a stopped
        // event is fired, an error will be displayed as a result of the start
        // promise rejecting.
        // TODO: consider removing error field from STOP_GETTING_FROM_FRIEND
        // The UI should know whether it was a user-initiated stopped event
        // or not (based on whether they clicked stop/logout, or based on
        // whether the browser's proxy was set).
        var isError =
            this.localGettingFromRemote == GettingState.GETTING_ACCESS;
        ui.update(uProxy.Update.STOP_GETTING_FROM_FRIEND,
                  {instanceId: this.instanceId, error: isError});

        this.localGettingFromRemote = GettingState.NONE;
        this.bytesSent = 0;
        this.bytesReceived = 0;
        this.user.notifyUI();
        this.socksToRtc_ = null;
        // Update global remoteProxyInstance to indicate we are no longer
        // getting access.
        remoteProxyInstance = null;
      });

      // Set flag to indicate that we are currently trying to get access
      this.localGettingFromRemote = GettingState.TRYING_TO_GET_ACCESS;
      this.user.notifyUI();

      // Cancel socksToRtc_ connection if start hasn't completed in 30 seconds.
      setTimeout(() => {
        if (this.localGettingFromRemote == GettingState.TRYING_TO_GET_ACCESS) {
          // This will cause the promise returned by this.socksToRtc_.start
          // to reject, which will trigger an error message in the UI.
          console.warn('Timing out socksToRtc_ connection');
          this.socksToRtc_.stop();
        }
      }, this.SOCKS_TO_RTC_TIMEOUT);

      return this.socksToRtc_.start(
          endpoint,
          this.socksRtcPcConfig)
        .then((endpoint:Net.Endpoint) => {
          console.log('Proxy now ready through ' + this.user.userId);
          this.localGettingFromRemote = GettingState.GETTING_ACCESS;
          this.user.notifyUI();
          return endpoint;
        }).catch((e:Error) => {
          // This may not be an error if the user cancelled proxying
          // before start had a chance to complete.  In that case a 'stopped'
          // event should still be emitted, and all cleanup can happen there.
          console.warn('Could not start proxy through ' + this.user.userId +
              '; ' + e.toString());
          this.localGettingFromRemote = GettingState.NONE;
          return Promise.reject('Could not start proxy');
        });
    }

    public updateClientProxyConnection = (isConnected :boolean) => {
      this.localSharingWithRemote =
          isConnected ? SharingState.SHARING_ACCESS : SharingState.NONE;
      this.user.notifyUI();
    }

    /**
     * Stop using this remote instance as a proxy server.
     */
    public stop = () : void => {
      if (this.localGettingFromRemote === GettingState.NONE) {
        console.warn('Cannot stop proxying when not proxying.');
        return;
      }
      this.localGettingFromRemote = GettingState.NONE;
      this.socksToRtc_.stop();
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
      this.onceLoaded_.then(() => {
        this.saveToStorage();
        this.user.notifyUI();
      });
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
        this.rtcToNet_.close();
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
      this.onceLoaded_.then(() => {
        if (this.user.isInstanceOnline(this.instanceId)) {
          this.user.network.sendInstanceHandshake(
              this.user.instanceToClient(this.instanceId), this.getConsentBits());
        }
      });
    }

    /**
     * Receive consent bits from the remote, and update consent values
     * accordingly.
     */
    public updateConsent = (bits:Consent.WireState) => {

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
        this.user.onceNameReceived.then(() => {
          ui.showNotification(this.user.name + note);
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
      this.onceLoaded_.then(() => {
        var state = this.currentState();
        storage.save<RemoteInstanceState>(this.getStorePath(), state)
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
      if (typeof this.description === 'undefined') {
        this.description = state.description;
        this.keyHash = state.keyHash;
        this.consent = state.consent;
      } else {
        this.consent.localRequestsAccessFromRemote =
            state.consent.localRequestsAccessFromRemote;
        this.consent.localGrantsAccessToRemote =
            state.consent.localGrantsAccessToRemote;
        this.saveToStorage();
        this.sendConsent();
      }
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

    private updateBytesInUI = () :void => {
      if (!this.isUIUpdatePending) {
        setTimeout(() => {
          this.user.notifyUI();
          this.isUIUpdatePending = false;
        }, 1000);
        this.isUIUpdatePending = true;
      }
    }

    public handleLogout = () => {
      if (this.rtcToNet_) {
        console.log('Closing rtcToNet_ for logout');
        this.rtcToNet_.close();
      }
      if (this.socksToRtc_) {
        console.log('Stopping socksToRtc_ for logout');
        this.stop();
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
