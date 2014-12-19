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
    public bytesSent   :number;
    public bytesReceived    :number;
    public readFromStorage :boolean = false;

    public consent     :Consent.State = new Consent.State();
    // Current proxy access activity of the remote instance with respect to the
    // local instance of uProxy.
    public access      :AccessState = {
      asClient: false,
      asProxy:  false
    };
    private transport  :Transport;
    // Whether or not there is a UI update (triggered by this.user.notifyUI())
    // scheduled to run in the next second.
    // Used by SocksToRtc & RtcToNet Handlers to make sure bytes sent and
    // received are only forwarded to the UI once every second.
    private isUIUpdatePending = false;

    // The configuration used to setup peer-connections. This should be
    // available under advanced options.
    public socksRtcPcConfig :WebRtc.PeerConnectionConfig = {
      webrtcPcConfig: {
         iceServers: core.globalSettings.stunServers
        },
        webrtcMediaConstraints: {
          optional: [{DtlsSrtpKeyAgreement: true}]
        },
        peerName: 'socksRtc'
      };
    public rtcNetPcConfig :WebRtc.PeerConnectionConfig = {
      webrtcPcConfig: {
         iceServers: core.globalSettings.stunServers
        },
        webrtcMediaConstraints: {
          optional: [{DtlsSrtpKeyAgreement: true}]
        },
        peerName: 'rtcNet'
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
            this.readFromStorage = true;
            this.user.notifyUI();
          }).catch((e) => {
            this.user.notifyUI();
            this.readFromStorage = true;
            console.log('Did not have consent state for this instanceId');
          });

      this.bytesSent = 0;
      this.bytesReceived = 0;
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
     */
    public handleSignal = (type:uProxy.MessageType,
                           signalFromRemote:Object) => {
      switch (type) {
        case uProxy.MessageType.SIGNAL_FROM_CLIENT_PEER:
          if (!this.consent.localGrantsAccessToRemote) {
            console.warn('Remote side attempted access without permission');
            return;
          }
          // If the remote peer sent signal as the client, we act as server.
          if(!this.rtcToNet_) {
            // TODO: make this into a separate function
            this.rtcToNet_ = new RtcToNet.RtcToNet(
                this.rtcNetPcConfig, this.rtcNetProxyConfig);
            this.rtcToNet_.onceClosed.then(() => {
              console.log('rtcToNet_.onceClosed called');
              this.access.asClient = false;
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
              this.access.asClient = true;
              ui.update(uProxy.Update.START_GIVING_TO_FRIEND, this.instanceId);
              this.user.notifyUI();
            });
          }
          // TODO: signalFromRemote needs to get converted into a
          // WebRtc.SignallingMessage. This probably doesn't actually work right
          // now.
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
      } else if (this.access.asProxy) {
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
      this.socksToRtc_ = new SocksToRtc.SocksToRtc(
          endpoint,
          this.socksRtcPcConfig);
      this.socksToRtc_.signalsForPeer.setSyncHandler((signal) => {
        this.send({
          type: uProxy.MessageType.SIGNAL_FROM_CLIENT_PEER,
          data: signal
        });
      });
      // When bytes are sent to or received through the proxy, notify the
      // UI about the increase in data exchanged. Increment the bytes
      // sent/received variables in real time, but use a timer to control
      // when notifyUI() is called.
      this.socksToRtc_.bytesReceivedFromPeer
          .setSyncHandler((numBytes:number) => {
        this.bytesReceived += numBytes;
        this.updateBytesInUI();
      });
      this.socksToRtc_.bytesSentToPeer
          .setSyncHandler((numBytes:number) => {
        this.bytesSent += numBytes;
        this.updateBytesInUI();
      });
      // TODO: Update to onceReady() once uproxy-networking fixes it.
      return this.socksToRtc_.onceReady.then((endpoint:Net.Endpoint) => {
          console.log('Proxy now ready through ' + this.user.userId);
          this.access.asProxy = true;
          this.user.notifyUI();
          this.socksToRtc_.onceStopped().then(() => {
            console.log('socksToRtc_.onceStopped called');
            ui.update(uProxy.Update.STOP_GETTING_FROM_FRIEND,
                      {instanceId: this.instanceId,
                       error: this.access.asProxy});
            this.access.asProxy = false;
            this.bytesSent = 0;
            this.bytesReceived = 0;
            // TODO: notification to the user on remote-close?
            this.user.notifyUI();
            this.socksToRtc_ = null;
            // Update global remoteProxyInstance to indicate we are no longer
            // getting access.
            remoteProxyInstance = null;
          });
          return endpoint;
        })
        // TODO: remove catch & error print: that should happen at the level
        // above.
        .catch((e:Error) => {
          console.error('Could not start proxy through ' + this.user.userId +
              '; ' + e.toString());
          return Promise.reject('Could not start proxy');
        });
    }

    public updateClientProxyConnection = (isConnected :boolean) => {
      this.access.asClient = isConnected;
      this.user.notifyUI();
    }

    /**
     * Stop using this remote instance as a proxy server.
     */
    public stop = () :void => {
      if (!this.access.asProxy) {
        console.warn('Cannot stop proxying when not proxying.');
        return;
      }
      this.access.asProxy = false;

      this.socksToRtc_.stop();
      // TODO: Remove the access.asProxy/asClient, maybe replace with getters
      // once whether socksToRtc_ or rtcToNet_ objects are null means the same.
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
      if (this.readFromStorage) {
        this.saveToStorage();
      }
      this.user.notifyUI();
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
      if (Consent.UserAction.CANCEL_OFFER === action && this.access.asClient) {
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
      this.user.network.sendInstanceHandshake(
          this.user.instanceToClient(this.instanceId), this.getConsentBits());
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
            note = this.user.name + ' granted you access.';
          } else {
            note = this.user.name + ' offered you access.';
          }
        } else {
          // newly revoked access
          if (!this.consent.ignoringRemoteUserOffer) {
            note = this.user.name + ' revoked your access.';
          }
        }
      }

      if (this.consent.remoteRequestsAccessFromLocal !== remoteWasRequestingAccess) {
        if (this.consent.remoteRequestsAccessFromLocal
            && !this.consent.ignoringRemoteUserRequest) {
          // newly requested/accepted access
          if (this.consent.localGrantsAccessToRemote) {
            note = this.user.name + ' has accepted your offer of access.';
          } else {
            note = this.user.name + ' is requesting access.';
          }
        }
        // No notification for cancelled requests.
      }

      if (note) {
        ui.showNotification(note);
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
      var state = this.currentState();
      storage.save<RemoteInstanceState>(this.getStorePath(), state)
          .then((old) => {
        console.log('Saved instance ' + this.instanceId + ' to storage.');
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
        instanceId:           this.instanceId,
        description:          this.description,
        keyHash:              this.keyHash,
        consent:              this.consent,
        access:               this.access,
        isOnline:             this.user.isInstanceOnline(this.instanceId),
        bytesSent:            this.bytesSent,
        bytesReceived:        this.bytesReceived
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
