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

interface ConsentState {
  asClient :Consent.ClientState;
  asProxy  :Consent.ProxyState;
}

interface ConsentMessage {
  instanceId :string;
  consent    :Consent.State;
}

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

    public instanceId    :string;
    public keyHash       :string
    public description   :string;

    public consent       :ConsentState;
    private clientId     :string;       // TODO: Do we need this here?
    private transport    :Transport;

    /**
     * Construct a Remote Instance as the result of receiving an instance
     * handshake. Typically, instances are initialized with the lowest consent
     * values.
     */
    constructor(
        public user :Core.User,  // The User which this instance belongs to.
        handshake   :Instance) {
      this.consent = {
        asClient: Consent.ClientState.NONE,
        asProxy:  Consent.ProxyState.NONE
      };
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
      // The overlay social network is responsible for mapping ourselves to the
      // clientId.
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

  }  // class Core.RemoteInstance

  // TODO: Implement obfuscation.
  export enum ObfuscationType {NONE, RANDOM1 }

}  // module Core
