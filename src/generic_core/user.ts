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
/// <reference path='util.ts' />

/// <reference path='../uproxy.ts' />
/// <reference path='../interfaces/instance.d.ts' />
/// <reference path='../interfaces/user.d.ts' />
/// <reference path='../freedom/typings/social.d.ts' />

module Core {
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

    // Name of the user as provided by the social network.
    public name :string;
    public clientIdToStatusMap :{ [clientId :string] :UProxyClient.Status };
    public profile :freedom_Social.UserProfile;

    // Each instance is a user and social network pair.
    private instances_ :{ [instanceId :string] :Core.RemoteInstance };
    private clientToInstanceMap_ :{ [clientId :string] :string };
    private instanceToClientMap_ :{ [instanceId :string] :string };

    private fulfillStorageLoad_ : () => void;
    public onceLoaded : Promise<void> = new Promise<void>((F, R) => {
      this.fulfillStorageLoad_ = F;
    }).then(() => {
      this.notifyUI();
    });

    private fulfillNameReceived_ : (string) => void;
    public onceNameReceived : Promise<string> = new Promise<string>((F, R) => {
      this.fulfillNameReceived_ = F;
    });
    public static numberOfUsers = 0;

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
      numberOfUsers++;
      console.log('New user: ' + userId);
      this.name = 'pending';
      this.profile = {
        userId: this.userId,
        timestamp: Date.now()
      }
      this.clientIdToStatusMap = {};
      this.instances_ = {};
      this.clientToInstanceMap_ = {};
      this.instanceToClientMap_ = {};

      storage.load<UserState>(this.getStorePath()).then((state) => {
        this.restoreState(state);
        this.fulfillStorageLoad_();
      }).catch((e) => {
        // User not found in storage - we should fulfill the create promise
        // anyway as this is not an error.
        this.fulfillStorageLoad_();
      });
    }

    /**
     * Update the information about this user.
     * The userId must match.
     */
    public update = (profile :freedom_Social.UserProfile) : void => {
      if (profile.userId != this.userId) {
        throw Error('Updating User ' + this.userId +
                    ' with unexpected userID: ' + profile.userId);
      }
      this.name = profile.name;
      this.fulfillNameReceived_(this.name);
      this.profile = profile;
      this.log('Updating...');
      this.saveToStorage();
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
        console.warn('Cannot send message to non-existing instance ' +
                     instanceId);
        return Promise.reject(new Error(
            'Cannot send to invalid instance ' + instanceId));
      }
      var clientId = this.instanceToClientMap_[instanceId];
      return this.network.send(clientId, payload).then(() => {
        return clientId;
      });
    }

    /**
     * Handle 'onClientState' events from the social provider, which indicate
     * changes in status such as becoming online, offline.
     *  - Only adds uProxy clients to the clients table.
     *  - Sends local instance information as an 'Instance Handshake' to the
     *    remote client if it is known to be uProxy client.
     */
    public handleClient = (client :UProxyClient.State) : void => {
      if (client.userId != this.userId) {
        console.error(this.userId +
            'received client with unexpected userId: ' + client.userId);
        return;
      }
      else if (client.status == UProxyClient.Status.ONLINE_WITH_OTHER_APP) {
        // Ignore non-uproxy contacts
        return;
      }

      this.log('received client' + JSON.stringify(client));
      if (client.clientId in this.clientIdToStatusMap &&
          this.clientIdToStatusMap[client.clientId] == client.status) {
        // Client is already in mapping and its status has not changed, skip.
        // This is done to skip onClientState events we get for each message
        // when only the timestamp has been updated.
        console.log('Client already in memory and is unchanged');
        return;
      }

      switch (client.status) {
        // Send an instance message to newly ONLINE remote uProxy clients.
        case UProxyClient.Status.ONLINE:
          if (!(client.clientId in this.clientIdToStatusMap) ||
              this.clientIdToStatusMap[client.clientId] != UProxyClient.Status.ONLINE) {
            // Client is new, or has changed status from !ONLINE to ONLINE.
            this.network.sendInstanceHandshake(client.clientId,
                this.getConsentForClient_(client.clientId));
          }
          this.clientIdToStatusMap[client.clientId] = client.status;
          break;
        case UProxyClient.Status.OFFLINE:
          // Just delete OFFLINE clients, because they will never be ONLINE
          // again as the same clientID (removes clientId from clientIdToStatusMap
          // and related data structures).
          this.removeClient_(client.clientId);
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
    public handleMessage = (clientId :string, msg :uProxy.Message) : void => {
      if (!(clientId in this.clientIdToStatusMap)) {
        var errorStr = this.userId +
            ' received message for non-existing client: ' + clientId;
        console.error(errorStr);
        return;
      }
      var msgType :uProxy.MessageType = msg.type;
      switch (msg.type) {
        case uProxy.MessageType.INSTANCE:
          this.syncInstance_(clientId, <InstanceMessage>msg.data);
          return;

        case uProxy.MessageType.SIGNAL_FROM_CLIENT_PEER:
        case uProxy.MessageType.SIGNAL_FROM_SERVER_PEER:
          var instance = this.getInstance(this.clientToInstance(clientId));
          if (!instance) {
            // TODO: this may occur due to a race condition where uProxy has
            // received an onUserProfile and onClientState event, but not yet
            // recieved and instance message, and the peer tries to start
            // proxying.  We should fix this somehow.
            // issues: https://github.com/uProxy/uproxy/pull/732
            console.error('failed to get instance for clientId ' + clientId);
            return;
          }
          instance.handleSignal(msg.type, msg.data);
          return;

        case uProxy.MessageType.INSTANCE_REQUEST:
          console.log('got instance request from ' + clientId);
          this.network.sendInstanceHandshake(
              clientId, this.getConsentForClient_(clientId));
          return;

        default:
          var errorStr = this.userId + ' received invalid message.' + msg;
          console.error(errorStr);
      }
    }

    private getConsentForClient_ = (clientId :string) : Consent.WireState => {
      var instanceId = this.clientToInstanceMap_[clientId];
      if (typeof instanceId === 'undefined') {
        return null;
      }
      return (this.instances_[instanceId]).getConsentBits();;
    }

    public getInstance = (instanceId:string) : Core.RemoteInstance => {
      return this.instances_[instanceId];
    }

    /**
     * Helper that returns the local user's instance ID.
     * TODO: This API is confusing because it doesn't return the instance
     * for this (remote) user object, but instead returns information about the
     * user running uProxy.  We should clean this up somehow.
     */
    public getLocalInstanceId = () : string => {
      return this.network.getLocalInstance().instanceId;
    }

    /**
     * Synchronize with new remote instance data, update the instance-client
     * mapping, save to storage, and update the UI.
     * Assumes the clientId associated with this instance is valid and belongs
     * to this user.
     * In no case will this function fail to generate or update an entry of
     * this user's instance table.
     */
    public syncInstance_ = (clientId :string, data :InstanceMessage) : void => {
      // TODO: use handlerQueues to process instances messages in order, to
      // address potential race conditions described in
      // https://github.com/uProxy/uproxy/issues/734
      var instance : InstanceHandshake = data.handshake;
      if (UProxyClient.Status.ONLINE !== this.clientIdToStatusMap[clientId]) {
        console.error('Received an Instance Handshake from a non-uProxy client! '
                     + clientId);
        return;
      }
      this.log('received instance' + JSON.stringify(data));
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
        if (!data.consent) {
          existingInstance.sendConsent();
        } else {
          existingInstance.updateConsent(data.consent);
        }
      } else {
        // Create a new instance.
        var newInstance = new Core.RemoteInstance(this, instanceId, instance);
        this.instances_[instanceId] = newInstance;
        this.saveToStorage();
        this.notifyUI();
        if (data.consent) {
          newInstance.updateConsent(data.consent);
        }
      }
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
    private removeClient_ = (clientId:string) : void => {
      delete this.clientIdToStatusMap[clientId];
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
    public notifyUI = () : void => {
      if ('pending' == this.name) {
        this.log('Not showing UI without profile.');
        return;
      }

      // TODO: there is a bug where sometimes this.profile.name is not set,
      // even though we have this.name set.  This should be tracked down, but for now
      // we can just copy this.name to this.profile.name.
      if (!this.profile.name) {
        this.profile.name = this.name;
      }

      var instanceStatesForUi = [];
      for (var instanceId in this.instances_) {
        instanceStatesForUi.push(
            this.instances_[instanceId].currentStateForUi());
      }
      if (instanceStatesForUi.length === 0) {
        // Don't send users to UI if they don't have any instances (i.e. are not
        // uProxy users).
        // TODO: ideally we should not have User objects for users without
        // instances, but for now we create Users whenever we get a UserProfile
        // or ClientState from the social provider that isn't
        // ONLINE_WITH_OTHER_APP.  For now this is necessary because we don't
        // yet load instances from storage until User objects are created.
        return;
      }

      // TODO: There is a bug in here somewhere. The UI message doesn't make it,
      // sometimes.
      ui.syncUser(<UI.UserMessage>{
        network: this.network.name,
        user: {
          userId: this.profile.userId,
          name: this.profile.name,
          imageData: this.profile.imageData
        },
        instances: instanceStatesForUi
      })
      this.log('Sent myself to UI. \n' +
          JSON.stringify(this.clientToInstanceMap_) + ' with ' +
          JSON.stringify(instanceStatesForUi));
    }

    /**
     * Helper which logs messages clearly belonging to this Core.User.
     */
    private log = (msg:string) : void => {
      console.log('[User ' + this.name + '] ' + msg);
    }

    public monitor = () : void => {
      for (var clientId in this.clientIdToStatusMap) {
        var isMissingInstance =
            (this.clientIdToStatusMap[clientId] == UProxyClient.Status.ONLINE) &&
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

    public isInstanceOnline = (instanceId :string) : boolean => {
      var clientId = this.instanceToClientMap_[instanceId];
      if (!clientId) {
        return false;
      }
      var status = this.clientIdToStatusMap[clientId];
      if (status == UProxyClient.Status.ONLINE) {
        return true;
      }
      return false;
    }

    public getStorePath() {
      return this.network.getStorePath() + this.userId;
    }

    public saveToStorage = () : void => {
      this.onceLoaded.then(() => {
        var state = this.currentState();
        storage.save<UserState>(this.getStorePath(), state).then((old) => {});
      });
    }

    public restoreState = (state :UserState) : void => {
      if (this.name === 'pending') {
        this.name = state.name;
      }

      if (this.name !== 'pending') {
        this.fulfillNameReceived_(this.name);
      }

      if (typeof this.profile.imageData === 'undefined') {
        this.profile.imageData = state.imageData;
      }

      // Restore all instances.
      for (var i in state.instanceIds) {
        var instanceId = state.instanceIds[i];
        if (!(instanceId in this.instances_)) {
          this.instances_[instanceId] = new Core.RemoteInstance(this, instanceId, null);
        }
      }
    }

    public currentState = () :UserState => {
      return cloneDeep({
        name : this.name,
        imageData: this.profile.imageData,
        instanceIds: Object.keys(this.instances_)
      });
    }

    public handleLogout = () : void => {
      for (var instanceId in this.instances_) {
        this.instances_[instanceId].handleLogout();
      }
    }

    public resendInstanceHandshakes = () : void => {
      for (var instanceId in this.instanceToClientMap_) {
        var clientId = this.instanceToClientMap_[instanceId];
        this.network.sendInstanceHandshake(
            clientId, this.getConsentForClient_(clientId));
      }
    }

  }  // class User

  export interface UserState {
    name        :string;
    imageData     :string;
    // Only save and load the instanceIDs. The actual RemoteInstances will
    // be saved and loaded separately.
    instanceIds :string[];
  }

}  // module uProxy
