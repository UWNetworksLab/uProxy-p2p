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
  export class User implements BaseUser, Core.Persistent {

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
    constructor(public network :Social.Network,
                public userId  :string) {
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
      this.saveToStorage();
    }

    /**
     * Obtain the storage prefix of this User.
     * Assumption: Although Alice's userId may appear differently to Bob and
     * Charlie, the potentially-different userIds will remain the same,
     * individually to Bob and Charlie. Therefore we can use userId as part of
     * the storage prefix.
     */
    public getStorePath = () => {
      return this.network.getStorePath() + this.userId;
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
      this.saveToStorage();
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
        console.warn('Cannot send message to non-existing instance ' +
                     instanceId);
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
      if (client.clientId in this.clients &&
          this.clients[client.clientId] == client.status) {
        // Client is already in mapping and its status has not changed, skip.
        // This is done to skip onClientState events we get for each message
        // when only the timestamp has been updated.
        return;
      }

      switch (client.status) {
        // Send an instance message to newly ONLINE remote uProxy clients.
        case UProxyClient.Status.ONLINE:
          if (!(client.clientId in this.clients) ||
              this.clients[client.clientId] != UProxyClient.Status.ONLINE) {
            // Client is new, or has changed status from !ONLINE to ONLINE.
            this.network.sendInstanceHandshake(client.clientId);
          }
          this.clients[client.clientId] = client.status;
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
          this.syncInstance_(clientId, <InstanceHandshake>msg.data);
          break;
        case uProxy.MessageType.CONSENT:
          this.handleConsent_(<ConsentMessage>msg.data);
          break;
        case uProxy.MessageType.SIGNAL_FROM_CLIENT_PEER:
        case uProxy.MessageType.SIGNAL_FROM_SERVER_PEER:
          var instance = this.getInstance(this.clientToInstance(clientId));
          if (!instance) {
            // TODO: this may occur due to a race condition where uProxy has
            // received an onUserProfile and onClientState event, but not yet
            // recieved and instance message, and the peer tries to start
            // proxying.  We should fix this somehow.
            console.error('failed to get instance for clientId ' + clientId);
            return;
          }
          instance.handleSignal(msg.type, <PeerSignal>msg.data);
          break;
        case uProxy.MessageType.INSTANCE_REQUEST:
          console.log('got instance request from ' + clientId);
          this.network.sendInstanceHandshake(clientId);
          break;
        default:
          console.error(this.userId + ' received invalid message.', msg);
      }
    }

    public getInstance = (instanceId:string) => {
      return this.instances_[instanceId];
    }

    /**
     * Helper which returns the local user's instance ID.
     * TODO: this API is confusing because it doesn't return the instance
     * for this (remote) user object, but instead returns information about the
     * user running uproxy.  We should clean this up somehow.
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
    private syncInstance_ = (clientId :string, instance :InstanceHandshake)
        : void => {
      if (UProxyClient.Status.ONLINE !== this.clients[clientId]) {
        console.error('Received an Instance Handshake from a non-uProxy client! '
                     + clientId);
        return;
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

      // TODO: this may send a duplicate notification to the UI, because
      // instance.update and the instance constructor both notify the UI.
      // This shouldn't be a problem but we may want to clean this up.
      this.notifyUI();
      // TODO: Make ui.syncInstance actually do the granular-level update to UI.
      ui.syncInstance(this.instances_[instanceId]);
      ui.syncMappings();
      this.saveToStorage();
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
      // TODO: Fully support multiple instances, with the UI to go with it,
      // or alternatively send all instances to the UI and let the UI pick
      // which to show.  For now, we only send most recent instance which
      // currently has a client mapped to it.
      var mostRecentInstance = null;
      for (var instanceId in this.instances_) {
        var instance = this.instances_[instanceId];
        if (!mostRecentInstance ||
            instance.updateDate > mostRecentInstance.updateDate) {
          mostRecentInstance = instance;
        }
      }
      var instances =
          mostRecentInstance ? [mostRecentInstance.serializeForUI()] : [];

      // TODO: there is a bug where sometimes this.profile.name is not set,
      // even though we have this.name set.  This should be tracked down, but for now
      // we can just copy this.name to this.profile.name.
      if (!this.profile.name) {
        this.profile.name = this.name;
      }

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

    /**
     * Get the raw attributes of the User to be sent over UI or saved to
     * storage.
     */
    public serialize = () : SerialUser => {
      return {
        userId: this.userId,
        name: this.name,
        instanceIds: Object.keys(this.instances_)
      }
    }
    public deserialize = (json :SerialUser) => {
      this.userId = json.userId;
      this.name = json.name;
      this.instances_ = {};
      // Load actual instance objects.
      for (var i = 0 ; i < json.instanceIds.length ; ++i) {
        this.loadInstanceFromStorage_(json.instanceIds[i]);
      }
      this.log('Loaded ' + Object.keys(this.instances_).length + ' instances');
      this.notifyUI();
    }
    private loadInstanceFromStorage_ = (instanceId :string) => {
      storage.load<Core.SerialRemoteInstance>(this.getStorePath() + instanceId)
          .then((json) => {
        this.instances_[instanceId] = new Core.RemoteInstance(this, json);
      }).catch((e) => {
        this.log('could not load instance ' + instanceId);
      });
    }
    private saveToStorage = () => {
      var json = this.serialize();
      storage.save<SerialUser>(this.getStorePath(), json)
          .then((old) => {
        this.log('saved to storage, ' + this.userId);
      }).catch((e) => {
        console.error('failed to save user to storage: ' + this.userId);
      });
    }

    public monitor = () : void => {
      for (var clientId in this.clients) {
        var isMissingInstance =
            (this.clients[clientId] == UProxyClient.Status.ONLINE) &&
            !(clientId in this.clientToInstanceMap_);
        if (isMissingInstance) {
          console.warn('monitor found no instance for clientId ' + clientId);
          this.requestInstance_(clientId);
        }
      }
    }

    private requestInstance_ = (clientId) : void => {
      this.log('requesting instance');
      var instanceRequestMsg :uProxy.Message = {
        type: uProxy.MessageType.INSTANCE_REQUEST,
        data: {}
      };
      this.network.send(clientId, instanceRequestMsg);
    }

  }  // class User

  export interface SerialUser {
    userId      :string;
    name        :string;
    // Only save and load the instanceIDs. The actual RemoteInstances will
    // be saved and loaded separately.
    instanceIds :string[];
    // Don't save the clients, because those are completely ephemeral.
  }

}  // module uProxy
