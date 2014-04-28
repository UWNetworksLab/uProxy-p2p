/**
 * user.ts
 *
 * This file defines the uProxy User class. :User is a type relevant both in the
 * Core and the UI, which is why it is in the top-level directory.
 *
 * Here is further information on the interactions between Clients and
 * Instances.
 *
 * Clients hold state for 'a user logged onto a network from a specific device'.
 * They are also ephemeral, so once the client logs out, it is gone forever
 * (the next time the user logs on from the same device to the same network,
 * there will be a new client ID).
 *
 * An Instance is specific to a client running uProxy. More precisely, an
 * Instance represents 'a uProxy installation on a device for a user', and are
 * semi-permanent. Since clients are ephemeral, an Instance can/will be
 * associated with multiple clients over its lifetime, as its uProxy clients
 * login and logout. There will however, only ever be one client at a time.
 * The tricky bit is that the Instance is associated not with the 'human' chat
 * client, but with the 'uProxy' non-human client.
 */
/// <reference path='remote-instance.ts' />

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
    private instances_ :{ [instanceId :string] :Core.RemoteInstance };
    private clientToInstanceMap_ :{ [clientId :string] :string };
    private instanceToClientMap_ :{ [instanceId :string] :string };

    /**
     * Users are constructed when receiving a :UserProfile message from the
     * social provider. They maintain a reference to the social provider
     * |network| they are associated with.
     */
    constructor(private network :Social.Network,
                private profile :freedom.Social.UserProfile) {
      // console.log('New user: ' + profile.userId);
      this.name = profile.name;
      this.userId = profile.userId;
      this.clients = {};
      this.instances_ = {};
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
     * Send a message to an Instance belonging to this user.
     * Warns if instanceId does not exist on this user.
     */
    public send = (instanceId :string, payload :uProxy.Message) => {
      if (!(instanceId in this.instances_)) {
        console.warn('Cannot send message to non-existing instance ' + instanceId);
        return;
      }
      // TODO: Use the send method off the Instance object, once it exists.
      this.network.send(instanceId, payload);
    }

    /**
     * Handle 'onClientState' events from the social provider, which indicate
     * changes in status such as becoming online, offline.
     *  - Only adds uProxy clients to the clients table.
     *  - Sends local instance information as an 'Instance Handshake' to the
     *    remote client if it is known to be uProxy client.
     */
    public handleClient = (client :freedom.Social.ClientState) => {
      if (client.userId != this.userId) {
        console.error(this.userId +
            'received client with unexpected userId: ' + client.userId);
        return;
      }
      var clientIsNew = !(client.clientId in this.clients);
      switch (client.status) {
        // Send an instance message to newly ONLINE remote uProxy clients.
        case freedom.Social.Status.ONLINE:
          this.clients[client.clientId] = client.status;
          if (clientIsNew) {
            this.network.sendInstanceHandshake(client.clientId);
          }
          break;
        case freedom.Social.Status.OFFLINE:
          // Just delete OFFLINE clients, because they will never be ONLINE
          // again as the same clientID.
          this.removeClient_(client.clientId);
          break;
        case freedom.Social.Status.ONLINE_WITH_OTHER_APP:
          // TODO: Figure out potential invite or chat-mechanism for non-uProxy
          // clients.
          break;
        default:
          console.warn('Received client ' + client.clientId +
              ' with invalid status: ' + client.status);
          break;
      }
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

    public getInstance = (instanceId:string) => {
      return this.instances_[instanceId];
    }

    /**
     * Synchronize with new remote instance data, update the instance-client
     * mapping, save to storage, and update the UI.
     * Assumes the clientId associated with this instance is valid and belongs
     * to this user.
     * In no case will this function fail to generate or update an entry of
     * this user's instance table.
     */
    private syncInstance_ = (clientId :string, instance :Instance) => {
      if (freedom.Social.Status.ONLINE !== this.clients[clientId]) {
        console.warn('Received an Instance Handshake from a non-uProxy client! '
                     + clientId);
        return false;
      }
      var instanceId = instance.instanceId;
      var oldClientId = this.instanceToClientMap_[instance.instanceId];
      if (oldClientId) {
        // Remove old mapping if it exists.
        this.clientToInstanceMap_[oldClientId] = null;
      }
      this.clientToInstanceMap_[clientId] = instanceId;
      this.instanceToClientMap_[instanceId] = clientId;

      // Create or update the Instance object.
      var existingInstance = this.instances_[instanceId];
      if (existingInstance) {
        existingInstance.update(instance);
        // Send consent, if we have had past relationships with this instance.
        existingInstance.sendConsent();
      }
      this.instances_[instanceId] = new Core.RemoteInstance(this.network, instance);

      ui.syncInstance(store.state.instances[instanceId]);
      ui.syncMappings();
      // TODO: save to storage.
    }

    /**
     * Receive a consent message. Update the consent between the piece.
     * Assumes the instance associated with the consent message is valid and
     * belongs to this user.
     */
    private handleConsent_ = (consentMessage :any) => {
      var instanceId = consentMessage.instanceId;
      var instance = this.instances_[instanceId];
      if (!instance) {
        console.warn('Cannot update consent for non-existing instance!');
        return;
      }
      instance.modifyConsent(consentMessage.consent);
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
     * Remove a client from this User. Also removes the client <--> instance
     * mapping if it exists.
     */
    private removeClient_ = (clientId:string) => {
      delete this.clients[clientId];
      var instanceId = this.instanceToClientMap_[clientId];
      if (instanceId) {
        delete this.instanceToClientMap_[instanceId];
      }
      delete this.clientToInstanceMap_[clientId];
    }

  }  // class User

}  // module uProxy
