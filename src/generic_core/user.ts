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
   * Builts upon a freedom.Social.UserProfile.
   * Maintains a mapping between a User's clientIds and instanceIds, while
   * handling messages from its social provider to keep connection status,
   * instance messages, and consent up-to-date.
   */
  export class User implements BaseUser {

    public name :string;
    public userId :string;
    public clients :{ [clientId :string] :freedom.Social.Status };
    private instances_ :{ [instanceId :string] :Instance };
    private clientToInstanceMap_ :{ [clientId :string] :string };
    private instanceToClientMap_ :{ [instanceId :string] :string };

    /**
     * Users are constructed when receiving a :UserProfile message from the
     * social provider. They maintain a reference to the social provider
     * |network| they are associated with.
     */
    constructor(private network :Social.Network,
                private profile :freedom.Social.UserProfile) {
      this.name = profile.name;
      this.userId = profile.userId;
      this.clients = {};
      // TODO: Decide whether to contain the image, etc.
      this.clientToInstanceMap_ = {};
      this.instanceToClientMap_ = {};
    }

    /**
     * Update the information about this user.
     */
    public update = (latestProfile :freedom.Social.UserProfile) => {
      this.name = latestProfile.name;
      this.profile = latestProfile;
    }

    /**
     * Send a message to this user.
     * Warns if clientId does not exist on the user.
     */
    public send = (clientId :string, payload :uProxy.Message) => {
      if (!(clientId in this.clients)) {
        console.warn('Cannot send message to non-existing client ' + clientId);
        return;
      }
      this.network.api.sendMessage(clientId, JSON.stringify(payload));
    }

    /**
     * Handle 'onClientState' events from the social provider, which indicate
     * changes in status such as becoming online, offline.
     * Most importantly, sends the local instance information as an 'Instance
     * Message' to the remote client if it is known to be uProxy-enabled.
     */
    public handleClient = (client :freedom.Social.ClientState) => {
      if (client.userId != this.userId) {
        console.error(this.userId +
            'received client with unexpected userId: ' + client.userId);
        return;
      }
      var clientIsNew = !(client.clientId in this.clients);
      // Send an instance message to newly ONLINE remote uProxy clients.
      if (freedom.Social.Status.ONLINE == client.status &&
          clientIsNew) {
        // TODO: actually implement sending an InstanceMessage from here.
        this.send(client.clientId, null);
        // Set the instance mapping to null as opposed to undefined, to indicate
        // that we know the client is pending its corresponding instance data.
        // this.clientToInstanceMap_[clientId] = '';
      }
      // TODO: just delete OFFLINE clients, because they will never be useful
      // again. Also, test that behavior later.
      this.clients[client.clientId] = client.status;

      // case freedom.Social.Status.ONLINE_WITH_OTHER_APP:
        // break;
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
      if (!(incoming.from.clientId in this.clients)) {
        console.error(this.userId +
            ' received message for non-existing client: ' +
            incoming.from.clientId);
        return;
      }
      var msg :uProxy.Message = JSON.parse(incoming.message);
      var msgType :uProxy.MessageType = msg.type;
      switch (msg.type) {
        case uProxy.MessageType.INSTANCE:
          this.syncInstance_(incoming.from.clientId, <Instance>msg.data);
          break;
        case uProxy.MessageType.CONSENT:
          this.handleConsent_(msg.data);
          break;
        default:
          console.error(this.userId + ' received invalid message.');
      }
    }

    /**
     * Receive an Instance message & update the consent <--> instance mapping.
     * Assumes the clientId associated with this instance is valid and belongs
     * to this user.
     */
    private syncInstance_ = (clientId :string, instance :Instance) => {
      // if (freedom.Social.Status.ONLINE !== this.clients[clientId]) {
        // return false;
      // }
      var oldClientId = this.instanceToClientMap_[instance.instanceId];
      if (oldClientId) {
        // Remove old mapping if it exists.
        this.clientToInstanceMap_[oldClientId] = null;
      }
      this.clientToInstanceMap_[clientId] = instance.instanceId;
      this.instanceToClientMap_[instance.instanceId] = clientId;
      // TODO: do the rest of the sync / storage stuff.
    }

    /**
     * Receive a consent message. Update the consent between the piece.
     * Assumes the instance associated with the consent message is valid and
     * belongs to this user.
     */
    private handleConsent_ = (consent :any) => {
      // TODO: Put the new consent code in here.
    }

    /**
     * Maintain a mapping between clientIds and instanceIds.
     */
    public clientToInstance = (clientId :string) : string => {
      return this.clientToInstanceMap_[clientId];
    }

    public instanceToClient= (instanceId :string) : string => {
      return this.instanceToClientMap_[instanceId];
    }

    /**
     * Remove a client from this User.
     */
    private removeClient_ = (clientId:string) => {
    }

  }  // class User

}  // module uProxy
