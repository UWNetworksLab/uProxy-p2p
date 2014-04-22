/**
 * user.ts
 *
 * This file defines the uProxy User class. :User is a type relevant both in the
 * Core and the UI, which is why it is in the top-level directory.
 */
/// <reference path='../uproxy.ts' />
/// <reference path='../interfaces/user.d.ts' />
/// <reference path='../interfaces/instance.d.ts' />

module Core {

  /**
   * Core.User
   *
   * Maintains a mapping between clientIds and instanceIds, while handling
   * messages from its social provider regarding connection status, consent, and
   * Instances.
   */
  export class User implements BaseUser {

    public name :string;
    public userId :string;
    public clients;
    private clientToInstanceMap_ :{ [clientId :string] :Instance };

    /**
     * Users are constructed when receiving a :UserProfile message from the
     * social provider.
     */
    constructor(private profile :freedom.Social.UserProfile) {
      this.name = profile.name;
      this.userId = profile.userId;
      this.clients = {};
      // TODO: Decide whether to contain the image, etc.
      this.clientToInstanceMap_ = {};
    }

    /**
     * Handle 'onClientState' events from the social provider, which indicate
     * changes in status such as becoming online, offline.
     * If the clientId specified does not yet exist, add the client to the list.
     * If the userId of state does not match this user, throw an error.
     */
    public handleClientState = (state :freedom.Social.ClientState) => {
      if (state.userId != this.userId) {
        console.error(this.userId +
            'received ClientState with unexpected userId: ' + state.userId);
        return;
      }
      // Update the client. (Adds anew if it doesn't exist yet)
      this.clients[state.clientId] = state.status;
    }

    /**
     * Handle 'onMessage' events from the social provider, which can be any type
     * of message from another contact, then delegate the message to the correct
     * handler.
     * Emits an error for a message from a client which doesn't exist.
     */
    public handleMessage = (incoming :freedom.Social.IncomingMessage) => {
      if (incoming.from.userId != this.userId) {
        console.error(this.userId +
            ' received message with unexpected userId: ' + incoming.from.userId);
        return;
      }
      var msg :uProxy.Message = JSON.parse(incoming.message);
      var msgType :uProxy.MessageType = msg.type;
      switch (msg.type) {
        case uProxy.MessageType.INSTANCE:
          this.handleInstance_(<Instance>msg.data);
          break;
        case uProxy.MessageType.CONSENT:
          this.handleConsent_(msg.data);
          break;
        default:
          console.error(this.userId + ' received invalid message.');
      }
    }

    /**
     * Receive an Instance message. Update the consent <--> instance mapping.
     * Assumes the clientId associated with this instance is valid and belongs
     * to this user.
     */
    private handleInstance_ = (instance :Instance) => {
    }

    /**
     * Receive a consent message. Update the consent between the piece.
     * Assumes the instance associated with the consent message is valid and
     * belongs to this user.
     */
    private handleConsent_ = (consent :any) => {
      // TODO: Put the new consent code in here.
    }

    // TODO: clean this up with the new consent piece, and also put all
    // over-the-network stuff in its own module.
    private _msgReceivedHandlers = {
        'allow': receiveTrustMessage,
        'offer': receiveTrustMessage,
        'deny': receiveTrustMessage,
        'request-access': receiveTrustMessage,
        'cancel-request': receiveTrustMessage,
        'accept-offer': receiveTrustMessage,
        'decline-offer': receiveTrustMessage,
        'notify-instance': Core.receiveInstance,
        'notify-consent': Core.receiveConsent,
        'update-description': receiveUpdateDescription,
        'peerconnection-server' : receiveSignalFromServerPeer,
        'peerconnection-client' : receiveSignalFromClientPeer,
        'newly-active-client' : handleNewlyActiveClient,
        'newly-inactive-client' : handleInactiveClient
    };

    /**
     * Receive an Instance message.
     */
    private syncInstance = (instanceId) => {
      // TODO
    }

    /**
     * Maintain a mapping between clientIds and instanceIds.
     */
    private clientToInstance = () => {
    }

    /**
     * Remove a client from this User.
     */
    private removeClient_ = (clientId:string) => {
    }
  }  // class User

}  // module uProxy
