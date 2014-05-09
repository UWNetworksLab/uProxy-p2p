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

  interface InstanceReconnection {
    promise :Promise<string>;  // Fulfilled with new clientID upon reconnection.
    fulfill :Function;         // Call fulfill when instance reconnects.
  }

  /**
   * Core.User
   *
   * Builts upon a freedom.Social.UserProfile.
   * Maintains a mapping between a User's clientIds and instanceIds, while
   * handling messages from its parent network to keep connection status,
   * instance messages, and consent up-to-date.
   *
   * NOTE: Deals with communications purely in terms of instanceIds.
   */
  export class User implements BaseUser {

    public name :string;
    public clients :{ [clientId :string] :UProxyClient.Status };
    public profile :freedom.Social.UserProfile;

    private instances_ :{ [instanceId :string] :Core.RemoteInstance };
    private clientToInstanceMap_ :{ [clientId :string] :string };
    private instanceToClientMap_ :{ [instanceId :string] :string };

    // Sometimes, sending messages to an instance fails because the client
    // corresponding to the instance has gone offline. In that case, we save a
    // promise for the next connection of that instance, for the future delivery
    // of that message.
    private reconnections_ :{ [instanceId :string] :InstanceReconnection };

    /**
     * Users are constructed purely on the basis of receiving a userId.
     * They may or may not have a :UserProfile (because the Network may have
     * received a ClientState or Message for the user, prior to receiving the
     * UserProfile from the social provider.)
     *
     * In any case, a User without a name is known to be 'pending', and should
     * not appear in the UI until actually receiving and being updated with a
     * full UserProfile.
     */
    constructor(private network :Social.Network,
                public userId   :string) {
      console.log('New user: ' + userId);
      this.name = 'pending';
      this.profile = {
        userId: this.userId,
        timestamp: Date.now()
      }
      this.clients = {};
      this.instances_ = {};
      this.reconnections_ = {};
      this.clientToInstanceMap_ = {};
      this.instanceToClientMap_ = {};
    }

    /**
     * Update the information about this user.
     * The userId must match.
     */
    public update = (profile :freedom.Social.UserProfile) => {
      if (profile.userId != this.userId) {
        throw Error('Updating User ' + this.userId +
                    ' with unexpected userID: ' + profile.userId);
      }
      this.name = profile.name;
      this.profile = profile;
      this.log('Updating...');
      this.notifyUI();
    }

    /**
     * Send a message to an Instance belonging to this user.
     * Warns if instanceId does not exist on this user.
     * If the instanceId does exist, but is currently offline (i.e. has no
     * client associated), then it delays the send until the next time that
     * instance becomes online using promises.
     *
     * Returns a promise that the message was sent to the instanceId, fulfilled
     * with the clientId of the recipient.
     */
    public send = (instanceId :string, payload :uProxy.Message)
        : Promise<string> => {
      if (!(instanceId in this.instances_)) {
        console.warn('Cannot send message to non-existing instance ' + instanceId);
        return Promise.reject(new Error(
            'Cannot send to invalid instance ' + instanceId));
      }
      var clientId = this.instanceToClientMap_[instanceId];
      var promise = Promise.resolve(clientId);
      if (!clientId) {
        // If this instance is currently offline...
        if (!this.reconnections_[instanceId]) {
          // Prepares a reconnection promise if necessary,
          promise = new Promise<string>((F, R) => {
            this.reconnections_[instanceId] = {
              promise: promise,
              fulfill: F
            }
          });
        } else {
          // or access the existing one, to attach the pending message to.
          promise = this.reconnections_[instanceId].promise;
        }
      }
      return <Promise<string>>promise.then((clientId) => {
        // clientId may have changed by the time this promise fulfills.
        clientId = this.instanceToClientMap_[instanceId];
        return this.network.send(clientId, payload).then(() => {
          return clientId;
        });
      });
    }

    /**
     * Handle 'onClientState' events from the social provider, which indicate
     * changes in status such as becoming online, offline.
     *  - Only adds uProxy clients to the clients table.
     *  - Sends local instance information as an 'Instance Handshake' to the
     *    remote client if it is known to be uProxy client.
     */
    public handleClient = (client :UProxyClient.State) => {
      if (client.userId != this.userId) {
        console.error(this.userId +
            'received client with unexpected userId: ' + client.userId);
        return;
      }
      this.log('received client' + JSON.stringify(client));
      var clientIsNew = !(client.clientId in this.clients);
      switch (client.status) {
        // Send an instance message to newly ONLINE remote uProxy clients.
        case UProxyClient.Status.ONLINE:
          this.clients[client.clientId] = client.status;
          if (clientIsNew) {
            this.network.sendInstanceHandshake(client.clientId);
          }
          break;
        case UProxyClient.Status.OFFLINE:
          // Just delete OFFLINE clients, because they will never be ONLINE
          // again as the same clientID.
          this.removeClient_(client.clientId);
          break;
        case UProxyClient.Status.ONLINE_WITH_OTHER_APP:
          // TODO: Figure out potential invite or chat-mechanism for non-uProxy
          // clients.
          break;
        default:
          console.warn('Received client ' + client.clientId +
              ' with invalid status: (' + client.status + ')');
          break;
      }
      this.notifyUI();
    }

    /**
     * Handle 'onMessage' events from the social provider, which can be any type
     * of message from another contact, then delegate the message to the correct
     * handler.
     * Emits an error for a message from a client which doesn't exist.
     */
    public handleMessage = (clientId :string, msg :uProxy.Message) => {
      if (!(clientId in this.clients)) {
        console.error(this.userId +
            ' received message for non-existing client: ' + clientId);
        return;
      }
      var msgType :uProxy.MessageType = msg.type;
      switch (msg.type) {
        case uProxy.MessageType.INSTANCE:
          this.syncInstance_(clientId, <Instance>msg.data);
          break;
        case uProxy.MessageType.CONSENT:
          this.handleConsent_(<ConsentMessage>msg.data);
          break;
        case uProxy.MessageType.SIGNAL_FROM_CLIENT_PEER:
        case uProxy.MessageType.SIGNAL_FROM_SERVER_PEER:
          var instance = this.getInstance(this.clientToInstance(clientId));
          instance.handleSignal(msg.type, <PeerSignal>msg.data);
          break;
        default:
          console.error(this.userId + ' received invalid message.');
      }
    }

    public getInstance = (instanceId:string) => {
      return this.instances_[instanceId];
    }

    /**
     * Helper which returns the local user's instance ID.
     */
    public getLocalInstanceId = () : string => {
      return this.network.getLocalInstanceId();
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
      if (UProxyClient.Status.ONLINE !== this.clients[clientId]) {
        console.warn('Received an Instance Handshake from a non-uProxy client! '
                     + clientId);
        return false;
      }
      this.log('received instance' + JSON.stringify(instance));
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
        this.fulfillReconnection_(instanceId);
        existingInstance.update(instance);
        // Send consent, if we have had past relationships with this instance.
        existingInstance.sendConsent();
      } else {
        this.instances_[instanceId] = new Core.RemoteInstance(this, instance);
      }

      this.notifyUI();
      // TODO: Fix ui.syncInstance.
      ui.syncInstance(store.state.instances[instanceId]);
      ui.syncMappings();
      // TODO: save to storage.
    }

    /**
     * Receive a consent message. Update the consent between the piece.
     * Assumes the instance associated with the consent message is valid and
     * belongs to this user.
     */
    private handleConsent_ = (consentMessage :ConsentMessage) => {
      var instanceId = consentMessage.instanceId;
      var instance = this.instances_[instanceId];
      if (!instance) {
        console.warn('Cannot update consent for non-existing instance!');
        return;
      }
      instance.receiveConsent(consentMessage.consent);
    }

    /**
     * Fulfill the reconnection (delivers pending messages) if it's there.
     */
    private fulfillReconnection_ = (instanceId:string) => {
      var newClientId = this.instanceToClientMap_[instanceId];
      if (!newClientId) {
        console.warn('Expected valid new clientId for ' + instanceId);
        // Try again next time (keep the reconnection so messages can still be
        // sent in the future).
        return;
      }
      var reconnect:InstanceReconnection = this.reconnections_[instanceId];
      if (reconnect) {
        reconnect.fulfill(newClientId);
      }
      // TODO: Make sure this doesn't affect multiple .thens().
      delete this.reconnections_[instanceId];
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
      var instanceId = this.clientToInstanceMap_[clientId];
      if (instanceId) {
        delete this.instanceToClientMap_[instanceId];
      }
      delete this.clientToInstanceMap_[clientId];
    }

    /**
     * Send the latest full state about everything in this user to the UI.
     * Only sends to UI if the user is ready to be visible. (has UserProfile)
     */
    public notifyUI = () => {
      if ('pending' == this.name) {
        this.log('Not showing UI without profile.');
        return;
      }
      // TODO: Fully support multiple instances, with the UI to go with it.
      // For now, only send instances which currently have a client mapped to
      // them.
      var instances = Object.keys(this.instances_).map((instanceId) => {
        return this.instances_[instanceId].serialize();
      });
      console.log(JSON.stringify(Object.keys(this.instances_)));
      console.log(JSON.stringify(instances));
      // TODO: There is a bug in here somewhere. The UI message doesn't make it,
      // sometimes.
      ui.syncUser(<UI.UserMessage>{
        network: this.network.name,
        user: this.profile,
        clients: valuesOf(this.clients),  // These are actually just Statuses.
        instances: instances
      })
      this.log('Sent myself to UI. \n' +
          JSON.stringify(this.clientToInstanceMap_) + ' with ' +
          JSON.stringify(instances));
    }

    /**
     * Helper which logs messages clearly belonging to this Core.User.
     */
    private log = (msg:string) : void => {
      console.log('[User ' + this.name + '] ' + msg);
    }

  }  // class User

}  // module uProxy
