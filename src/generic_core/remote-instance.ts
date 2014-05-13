/**
 * remote-instance.ts
 *
 * This file defines the uProxy Instance class for remote installations. It
 * allows any pair of uProxy installations to speak to one another regarding
 * consent, proxying status, and any other signalling information.
 */
/// <reference path='../interfaces/instance.d.ts' />
/// <reference path='consent.ts' />
/// <reference path='social.ts' />

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
  export class RemoteInstance implements Instance {

    public instanceId  :string;
    public keyHash     :string
    public description :string;

    public consent     :ConsentState = {
      asClient: Consent.ClientState.NONE,
      asProxy:  Consent.ProxyState.NONE
    };
    public access      :AccessState = {
      asClient: false,
      asProxy:  false
    };
    private transport  :Transport;

    /**
     * Construct a Remote Instance as the result of receiving an instance
     * handshake. Typically, instances are initialized with the lowest consent
     * values.
     */
    constructor(
        public user :Core.User,  // The User which this instance belongs to.
        handshake   :Instance) {
      this.update(handshake);
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
      this.log('RemoteInstance.send: ' + JSON.stringify(msg));
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
    public handleSignal = (type:uProxy.MessageType, signalFromWire:PeerSignal) => {
      console.log('RemoteInstance.handleSignal: ' + type + ', ' + signalFromWire);

      // Shared peer id over the social network only contains the instance ids,
      // not the full instance path.  We need to convert this to the
      // local peer id by adding the full instance path info (including userId
      // and network).
      console.log('about to parse peer id: ' + signalFromWire.peerId);
      var sharedPeerId :SharedPeerId = JSON.parse(signalFromWire.peerId);
      console.log('sharedPeerId is ' + JSON.stringify(sharedPeerId));
      var localInstanceId :string = this.user.getLocalInstanceId();
      console.log('localInstanceId is ' + localInstanceId);
      var isLocalServer :boolean = (type == uProxy.MessageType.SIGNAL_FROM_CLIENT_PEER);
      console.log('isLocalServer is ' + isLocalServer);
      var localPeerId :LocalPeerId = this.getLocalPeerId(isLocalServer);
      console.log('localPeerId is ' + JSON.stringify(localPeerId));

      // Signal sent to socks-rtc libraries should include local peer id (with network
      // and userId info).
      var signalForSocksRtc :PeerSignal = {
        peerId: JSON.stringify(localPeerId),
        data: signalFromWire.data
      };
      console.log('remote-instance.ts: handleSignal: signalForSocksRtc is '
          + JSON.stringify(signalForSocksRtc));

      switch (type) {
        case uProxy.MessageType.SIGNAL_FROM_CLIENT_PEER:
          // If the remote peer sent signal as the client, we act as server.
          if (sharedPeerId.serverInstanceId != localInstanceId) {
            console.error('Message to unexpected server: expected ' + localInstanceId
                + ', but got ' + sharedPeerId.serverInstanceId);
            return;
          }
          rtcToNetServer.emit('handleSignalFromPeer', signalForSocksRtc);
          break;
        case uProxy.MessageType.SIGNAL_FROM_SERVER_PEER:
          // If the remote peer sent signal as the server, we act as client.
          if (sharedPeerId.clientInstanceId != localInstanceId) {
            console.error('Message to unexpected server: expected ' + localInstanceId
                + ', but got ' + sharedPeerId.clientInstanceId);
            return;
          }
          socksToRtcClient.emit('handleSignalFromPeer', signalForSocksRtc);
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
    public start = () : void => {
      this.log('RemoteInstance.start');
      if (Consent.ProxyState.GRANTED !== this.consent.asProxy) {
        console.warn('Lacking permission to proxy!');
        return;
      }
      if (this.access.asProxy) {
        // This should not happen. If it does, something else is broken. Still, we
        // continue to actually proxy through the instance.
        console.warn('Already proxying through ' + this.instanceId);
        throw Error('Invalid proxy interaction!');
      }
      // TODO: sync properly between the extension and the app on proxy settings
      // rather than this cooincidentally the same data.
      // TODO: Convert socks-rtc's message types to Enums.

      // Speak with socks-rtc to start the connection.
      // The localhost host:port will be taken care of by WebRTC. The peerId is
      // utilized to set the local and remote descriptions on the
      // RTCPeerConnection.
      // TODO: See if we can use promises here.

      // PeerId sent to socks-rtc libraries should be LocalPeerId that includes
      // instanceId, userId, and network fields.
      // "false" parameter means the local instance is the client, not server.
      var localPeerId :LocalPeerId = this.getLocalPeerId(false);
      console.log('starting client with localPeerId: ' + JSON.stringify(localPeerId));
      socksToRtcClient.emit('start', {
          'host': '127.0.0.1', 'port': 9999,
           // Peer's peerId is the same as our InstancePath
           // TODO: make network public or change api.
          'peerId': JSON.stringify(localPeerId)
      });
      this.access.asProxy = true;
      this.user.notifyUI();
    }

    /**
     * Stop using this remote instance as a proxy server.
     */
    public stop = () : void => {
      this.log('RemoteInstance.stop');
      if (!this.access.asProxy) {
        console.error('Cannot stop proxying when not proxying.');
        return;
      }
      socksToRtcClient.emit('stop');
      this.access.asProxy = false;
      this.user.notifyUI();
    }

    /**
     * Update the information about this remote instance as a result of its
     * Instance Message.
     * Assumes that |data| actually belongs to this instance.
     */
    public update = (data :Instance) => {
      this.log('RemoteInstance.update');
      // TODO: copy the rest of the data.
      this.instanceId = data.instanceId;
    }

    /**
     * Modify the consent for this instance, *locally*. (User clicked on one of
     * the consent buttons in the UI.) Sends updated consent bits to the
     * remote instance afterwards.
     *
     * Gives a warning for UserActions which are invalid for the current state.
     */
    public modifyConsent = (action :Consent.UserAction) => {
      this.log('RemoteInstance.modifyConsent');
      switch(action) {
        // Actions affecting our consent towards the remote as our proxy.
        case Consent.UserAction.REQUEST:
        case Consent.UserAction.CANCEL_REQUEST:
        case Consent.UserAction.ACCEPT_OFFER:
        case Consent.UserAction.IGNORE_OFFER:
          var newProxyConsent = Consent.userActionOnProxyState(
              action, this.consent.asProxy);
          if (newProxyConsent) {
            this.consent.asProxy = newProxyConsent;
          } else {
            console.warn('Invalid proxy consent transition!',
                this.consent.asProxy, action);
            return;
          }
          break;
        // Actions affecting our consent towards the remote as our client.
        case Consent.UserAction.OFFER:
        case Consent.UserAction.CANCEL_OFFER:
        case Consent.UserAction.ALLOW_REQUEST:
        case Consent.UserAction.IGNORE_REQUEST:
          var newClientConsent = Consent.userActionOnClientState(
              action, this.consent.asClient);
          if (newClientConsent) {
            this.consent.asClient = newClientConsent;
          } else {
            console.warn('Invalid client consent transition!',
                this.consent.asClient, action);
            return;
          }
          break;
        default:
          console.warn('Invalid Consent.UserAction! ' + action);
          return;
      }
      // Send new consent bits to the remote client.
      this.sendConsent();
      // Send an update to the UI.
      this.user.notifyUI();
    }

    /**
     * Send consent bits to re-synchronize consent with remote |instance|.
     * This is expected *after* receiving an instance notification for an
     * already existing instance.
     */
    public sendConsent = () => {
      this.log('RemoteInstance.sendConsent');
      var consentPayload :uProxy.Message = {
        type: uProxy.MessageType.CONSENT,
        data: <ConsentMessage>{
          instanceId: this.user.getLocalInstanceId(),
          consent: this.getConsentBits()
        }
      };
      this.send(consentPayload);
    }

    /**
     * Receive consent bits from the remote, and update consent values
     * accordingly.
     */
    public receiveConsent = (bits:Consent.State) => {
      this.log('RemoteInstance.receiveConsent');
      this.consent.asProxy = Consent.updateProxyStateFromRemoteState(
          bits, this.consent.asProxy);
      this.consent.asClient = Consent.updateClientStateFromRemoteState(
          bits, this.consent.asClient);
      // TODO: save to storage and update ui.
      // store.saveInstance(this.instanceId);
      // TODO: Make the UI update granular for just the consent, instead of the
      // entire parent User for this instance.
      this.user.notifyUI();
    }

    /**
     * Return the pair of boolean consent bits indicating client and proxy
     * consent status, from the user's point of view. These bits will be sent on
     * thewire.
     */
    public getConsentBits = () : Consent.State => {
      return {
        isRequesting: Consent.ProxyState.userIsRequesting(this.consent.asProxy),
        isOffering: Consent.ClientState.userIsOffering(this.consent.asClient)
      };
    }

    /**
     * Get the raw attributes of the instance to be sent over to the UI.
     */
    public serialize = () : UI.Instance => {
      return {
        instanceId:  this.instanceId,
        description: this.description,
        keyHash:     this.keyHash,
        consent:     this.consent,
        access:      this.access
      }
    }

    private log = (msg:string) : void => {
      console.log('[Remote Instance for ' + this.user.name + '] ' + msg);
    }

    public getLocalPeerId = (isLocalServer :boolean)
        : LocalPeerId => {
      // Construct local and remote instance paths.
      var network :Social.Network = this.user.network;
      var localInstancePath :InstancePath = {
        network: network.name,
        userId: network.myInstance.userId,
        instanceId: network.myInstance.instanceId
      }
      var remoteInstancePath :InstancePath = {
        network: network.name,
        userId: this.user.userId,
        instanceId: this.instanceId
      }

      if (isLocalServer) {
        // Local instance is the server, remote instance is the client.
        return {
          clientInstancePath: remoteInstancePath,
          serverInstancePath: localInstancePath
        };
      } else {
        // Local instance is the client, remote instance is the server.
        return {
          clientInstancePath: localInstancePath,
          serverInstancePath: remoteInstancePath
        };
      }
    }

    public getSharedPeerId = (isLocalServer :boolean)
        : SharedPeerId => {
      // Construct local and remote instance paths.
      var network :Social.Network = this.user.network;
      var localInstanceId :string = network.myInstance.instanceId;
      var remoteInstanceId :string = this.instanceId;

      if (isLocalServer) {
        // Local instance is the server, remote instance is the client.
        return {
          clientInstanceId: remoteInstanceId,
          serverInstanceId: localInstanceId
        };
      } else {
        // Local instance is the client, remote instance is the server.
        return {
          clientInstanceId: localInstanceId,
          serverInstanceId: remoteInstanceId
        };
      }
    }

  }  // class Core.RemoteInstance

  // TODO: Implement obfuscation.
  export enum ObfuscationType {NONE, RANDOM1 }

}  // module Core
