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
     * Begin to use this remote instance as a proxy server, if permission is
     * currently granted.
     */
    public start = () : void => {
      if (Consent.ProxyState.GRANTED !== this.consent.asProxy) {
        console.warn('Lacking permission to proxy!');
        return;
      }
      if (this.access.asProxy) {
        // This should not happen. If it does, something else is broken. Still, we
        // continue to actually proxy through the instance.
        console.warn('Already proxying through ' + this.instanceId);
      }
      // TODO: sync properly between the extension and the app on proxy settings
      // rather than this cooincidentally the same data.
      // TODO: Convert socks-rtc's message types to Enums.

      // Speak with socks-rtc to start the connection.
      // The localhost host:port will be taken care of by WebRTC. The peerId is
      // utilized to set the local and remote descriptions on the
      // RTCPeerConnection.
      // TODO: See if we can use promises here.
      client.emit('start', {
          'host': '127.0.0.1', 'port': 9999,
           // Peer's peerId is the same as our instanceId..
          'peerId': this.instanceId
      });
      this.access.asProxy = true;
    }

    /**
     * Stop using this remote instance as a proxy server.
     */
    public stop = () : void => {
      if (!this.access.asProxy) {
        console.error('Cannot stop proxying when not proxying.');
        return;
      }
      client.emit('stop');
      this.access.asProxy = false;
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
     * Update the information about this remote instance as a result of its
     * Instance Message.
     * Assumes that |data| actually belongs to this instance.
     */
    public update = (data :Instance) => {
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
    }

    /**
     * Send consent bits to re-synchronize consent with remote |instance|.
     * This is expected *after* receiving an instance notification for an
     * already existing instance.
     */
    public sendConsent = () => {
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
      this.consent.asProxy = Consent.updateProxyStateFromRemoteState(
          bits, this.consent.asProxy);
      this.consent.asClient = Consent.updateClientStateFromRemoteState(
          bits, this.consent.asClient);
      // TODO: save to storage and update ui.
      // store.saveInstance(this.instanceId);
      ui.syncInstance(this, 'trust');
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

    /**
     * Obtain the fully qualified path to this instance.
     */
    public getPath = () : InstancePath => {
      return {
        network:    this.user['network'].name,
        userId:     this.user.userId,
        instanceId: this.instanceId
      }
    }

  }  // class Core.RemoteInstance

  // TODO: Implement obfuscation.
  export enum ObfuscationType {NONE, RANDOM1 }

}  // module Core
