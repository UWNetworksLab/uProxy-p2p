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
/// <reference path='../../../third_party/typings/freedom/freedom.d.ts' />

import logging = require('../../../third_party/uproxy-lib/logging/logging');
import remote_instance = require('./remote-instance');
import social = require('../interfaces/social');
import bridge = require('../../../third_party/uproxy-lib/bridge/bridge');
import consent = require('./consent');
import globals = require('./globals');
import ui = require('./ui_connector');
import uproxy_core_api = require('../interfaces/uproxy_core_api');
import _ = require('lodash');

import storage = globals.storage;

import Persistent = require('../interfaces/persistent');

var log :logging.Log = new logging.Log('remote-user');

  /**
   * remote_user.User
   *
   * Builts upon a freedom.Social.UserProfile.
   * Maintains a mapping between a User's clientIds and instanceIds, while
   * handling messages from its parent network to keep connection status,
   * instance messages, and consent up-to-date.
   *
   * NOTE: Deals with communications purely in terms of instanceIds.
   */
  export class User implements social.BaseUser, Persistent {

    // Name of the user as provided by the social network.
    public name :string;
    public clientIdToStatusMap :{ [clientId :string] :social.ClientStatus };
    public profile :freedom.Social.UserProfile;

    public consent :consent.State;

    // Each instance is a user and social network pair.
    private instances_ :{ [instanceId :string] :remote_instance.RemoteInstance };
    private clientToInstanceMap_ :{ [clientId :string] :string };
    private instanceToClientMap_ :{ [instanceId :string] :string };

    private fulfillStorageLoad_ : () => void;
    public onceLoaded : Promise<void> = new Promise<void>((F, R) => {
      this.fulfillStorageLoad_ = F;
    }).then(() => {
      this.notifyUI();
    });

    private fulfillNameReceived_ :(name:string) => void;
    public onceNameReceived : Promise<string> = new Promise<string>((F, R) => {
      this.fulfillNameReceived_ = F;
    });

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
    constructor(public network :social.Network,
                public userId  :string) {
      this.name = 'pending';
      this.profile = {
        userId: this.userId,
        name: '',
        timestamp: Date.now()
      }
      this.clientIdToStatusMap = {};
      this.instances_ = {};
      this.clientToInstanceMap_ = {};
      this.instanceToClientMap_ = {};

      this.consent =
          new consent.State(userId === this.network.myInstance.userId);

      storage.load<social.UserState>(this.getStorePath()).then((state) => {
        this.restoreState(state);
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
    public update = (profile :freedom.Social.UserProfile) : void => {
      if (profile.userId != this.userId) {
        throw Error('Updating User ' + this.userId +
                    ' with unexpected userID: ' + profile.userId);
      }
      this.name = profile.name;
      this.fulfillNameReceived_(this.name);
      this.profile = profile;
      this.saveToStorage();
      this.notifyUI();
    }

    /**
     * Handle 'onClientState' events from the social provider, which indicate
     * changes in status such as becoming online, offline.
     *  - Only adds uProxy clients to the clients table.
     *  - Sends local instance information as an 'Instance Handshake' to the
     *    remote client if it is known to be uProxy client.
     */
    public handleClient = (client :social.ClientState) : void => {
      if (client.userId != this.userId) {
        log.error('received client with unexpected userId', {
          clientUserId: this.userId,
          userId: client.userId
        });
        return;
      }

      log.debug('received client', client);
      if (client.clientId in this.clientIdToStatusMap &&
          this.clientIdToStatusMap[client.clientId] == client.status) {
        // Client is already in mapping and its status has not changed, skip.
        // This is done to skip onClientState events we get for each message
        // when only the timestamp has been updated.
        log.debug('Client already in memory and is unchanged', client.clientId);
        return;
      }

      switch (client.status) {
        // Send an instance message to newly ONLINE remote uProxy clients.
        case social.ClientStatus.ONLINE:
          if (!(client.clientId in this.clientIdToStatusMap) ||
              this.clientIdToStatusMap[client.clientId] != social.ClientStatus.ONLINE) {
            // Client is new, or has changed status from !ONLINE to ONLINE.
            this.sendInstanceHandshake(client.clientId);
          }
          this.clientIdToStatusMap[client.clientId] = client.status;
          break;
        case social.ClientStatus.OFFLINE:
        case social.ClientStatus.ONLINE_WITH_OTHER_APP:
          // Just delete OFFLINE clients, because they will never be ONLINE
          // again as the same clientID (removes clientId from clientIdToStatusMap
          // and related data structures).
          this.removeClient_(client.clientId);
          break;
        default:
          log.warn('Received client %1 with invalid status %2',
                   client.clientId, client.status);
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
    public handleMessage = (clientId :string,
        msg :social.VersionedPeerMessage) : void => {
      if (!(clientId in this.clientIdToStatusMap)) {
        log.error('%1 received message for non-existing client %2',
                  this.userId, clientId);
        return;
      }
      switch (msg.type) {
        case social.PeerMessageType.INSTANCE:
          this.syncInstance_(clientId, <social.InstanceHandshake>msg.data,
              msg.version).catch((e) => {
            log.error('syncInstance_ failed for ', msg.data);
          });
          return;

        case social.PeerMessageType.SIGNAL_FROM_CLIENT_PEER:
        case social.PeerMessageType.SIGNAL_FROM_SERVER_PEER:
          var instance = this.getInstance(this.clientToInstance(clientId));
          if (!instance) {
            // TODO: this may occur due to a race condition where uProxy has
            // received an onUserProfile and onClientState event, but not yet
            // recieved and instance message, and the peer tries to start
            // proxying.  We should fix this somehow.
            // issues: https://github.com/uProxy/uproxy/pull/732
            log.error('failed to get instance', clientId);
            return;
          }
          instance.handleSignal(msg);
          return;

        case social.PeerMessageType.INSTANCE_REQUEST:
          log.debug('received instance request', clientId);
          this.sendInstanceHandshake(clientId);
          return;

        default:
          log.error('received invalid message', {
            userId: this.userId,
            msg: msg
          });
      }
    }

    public getInstance = (instanceId:string) : remote_instance.RemoteInstance => {
      return this.instances_[instanceId];
    }

    /**
     * Helper that returns the local user's instance ID.
     * TODO: This API is confusing because it doesn't return the instance
     * for this (remote) user object, but instead returns information about the
     * user running uProxy.  We should clean this up somehow.
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
    public syncInstance_ = (
        clientId :string,
        instanceHandshake :social.InstanceHandshake,
        messageVersion :number) : Promise<void> => {
      // TODO: use handlerQueues to process instances messages in order, to
      // address potential race conditions described in
      // https://github.com/uProxy/uproxy/issues/734
      if (social.ClientStatus.ONLINE !== this.clientIdToStatusMap[clientId]) {
        log.error('Received an instance handshake from a non-uProxy client',
                  clientId);
        return Promise.reject(new Error(
            'Received an instance handshake from a non-uProxy client'));
      }
      log.info('received instance', instanceHandshake);
      if (!instanceHandshake.consent) {
        // This indicates that a user was running an old version of uProxy
        // (prior to moving consent to user).
        log.warn('No consent received with instance', instanceHandshake);
        return Promise.reject('No consent received with instance');
      }
      var instanceId = instanceHandshake.instanceId;
      var oldClientId = this.instanceToClientMap_[instanceId];
      if (oldClientId) {
        // Remove old mapping if it exists.
        this.clientToInstanceMap_[oldClientId] = null;
      }
      this.clientToInstanceMap_[clientId] = instanceId;
      this.instanceToClientMap_[instanceId] = clientId;

      // Set user's name from the instance, only if it is not yet set.
      // This is a work-around for not getting a UserProfile for some users,
      // see https://github.com/uProxy/uproxy/issues/1510
      if (instanceHandshake.name && this.name == 'pending') {
        log.info('No UserProfile available, setting name from instance');
        this.name = instanceHandshake.name;
        this.fulfillNameReceived_(instanceHandshake.name);
      } else if (instanceHandshake.userId && this.name == 'pending') {
        // Sometimes users don't get their own UserProfile.  In this case
        // if we haven't received their UserProfile either, we should set
        // their name to what they believe their userId is.  For GTalk users,
        // this should be the non-anomized ID (i.e. not a
        // @public.talk.google.com ID).
        log.info('No UserProfile available, setting name from userId');
        this.name = instanceHandshake.userId;
        this.fulfillNameReceived_(instanceHandshake.userId);
      }

      // Create or update the Instance object.
      var instance = this.instances_[instanceId];
      if (!instance) {
        // Create a new instance.
        instance = new remote_instance.RemoteInstance(this, instanceId);
        this.instances_[instanceId] = instance;
      }
      return instance.update(instanceHandshake,
          messageVersion).then(() => {
        this.saveToStorage();
        this.notifyUI();
      });
    }

    /**
     * Maintain a mapping between clientIds and instanceIds.
     */
    public clientToInstance = (clientId :string) : string => {
      return this.clientToInstanceMap_[clientId];
    }

    public instanceToClient = (instanceId :string) : string => {
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

    private ignoreUser_ = () => {
      return Object.keys(this.instances_).length === 0 &&
             (!this.network.areAllContactsUproxy() ||
               this.userId === this.network.myInstance.userId)
    }

    public currentStateForUI = () : social.UserData => {
      if ('pending' == this.name) {
        log.warn('Not showing UI without profile');
        return  null;
      }

      // TODO: there is a bug where sometimes this.profile.name is not set,
      // even though we have this.name set.  This should be tracked down, but for now
      // we can just copy this.name to this.profile.name.
      if (!this.profile.name) {
        this.profile.name = this.name;
      }

      var isOnline = false;
      var offeringInstanceStatesForUi :social.InstanceData[] = [];
      var allInstanceIds :string[] = [];
      var instancesSharingWithLocal :string[] = [];

      for (var instanceId in this.instances_) {
        allInstanceIds.push(instanceId);
        var instance = this.instances_[instanceId];
        if (instance.wireConsentFromRemote.isOffering) {
          offeringInstanceStatesForUi.push(instance.currentStateForUi());
        }
        if (!isOnline && this.isInstanceOnline(instanceId)) {
          isOnline = true;
        }
        if (instance.isSharing()) {
          instancesSharingWithLocal.push(instanceId);
        }
      }

      if (this.ignoreUser_()) {
        // Don't send users with no instances to the UI if either the network
        // gives us non-uProxy contacts, or it is the user we are logged in
        // with.
        return null;
      }

      // TODO: There is a bug in here somewhere. The UI message doesn't make it,
      // sometimes.
      return {
        network: this.network.name,
        user: {
          userId: this.profile.userId,
          name: this.profile.name,
          imageData: this.profile.imageData,
          url: this.profile.url
        },
        consent: this.consent,
        offeringInstances: offeringInstanceStatesForUi,
        instancesSharingWithLocal: instancesSharingWithLocal,
        allInstanceIds: allInstanceIds,
        isOnline: isOnline
      };
    }
    /**
     * Send the latest full state about everything in this user to the UI.
     * Only sends to UI if the user is ready to be visible. (has UserProfile)
     */
    public notifyUI = () : void => {
      this.onceLoaded.then(() => {
        var state = this.currentStateForUI();
        if (state) {
          ui.connector.syncUser(state);
        }
      });
    }

    public monitor = () : void => {
      for (var clientId in this.clientIdToStatusMap) {
        var isMissingInstance =
            (this.clientIdToStatusMap[clientId] == social.ClientStatus.ONLINE) &&
            !(clientId in this.clientToInstanceMap_);
        if (isMissingInstance) {
          log.warn('monitor could not find instance for clientId', clientId);
          this.requestInstance_(clientId);
        }
      }
    }

    private requestInstance_ = (clientId:string) : void => {
      log.debug('requesting instance', clientId);
      var instanceRequest :social.PeerMessage = {
        type: social.PeerMessageType.INSTANCE_REQUEST,
        data: {}
      };
      this.network.send(this, clientId, instanceRequest);
    }

    public isInstanceOnline = (instanceId :string) : boolean => {
      var clientId = this.instanceToClientMap_[instanceId];
      if (!clientId) {
        return false;
      }
      var status = this.clientIdToStatusMap[clientId];
      if (status == social.ClientStatus.ONLINE) {
        return true;
      }
      return false;
    }

    public getStorePath() {
      return this.network.getStorePath() + this.userId;
    }

    public saveToStorage = () : void => {
      this.onceLoaded.then(() => {
        if (!this.ignoreUser_()) {
          var state = this.currentState();
          storage.save(this.getStorePath(), state).catch(() => {
            log.error('Could not save user to storage');
          });
        }
      });
    }

    public restoreState = (state :social.UserState) : void => {
      if (this.name === 'pending') {
        this.name = state.name;
      }

      if (this.name !== 'pending') {
        this.fulfillNameReceived_(this.name);
      }

      if (typeof this.profile.imageData === 'undefined') {
        this.profile.imageData = state.imageData;
      }

      if (typeof this.profile.url === 'undefined') {
        this.profile.url = state.url;
      }

      // Restore all instances.
      var onceLoadedPromises :Promise<void>[] = [];
      for (var i in state.instanceIds) {
        var instanceId = state.instanceIds[i];
        if (!(instanceId in this.instances_)) {
          this.instances_[instanceId] = new remote_instance.RemoteInstance(this, instanceId);
          onceLoadedPromises.push(this.instances_[instanceId].onceLoaded);
        }

      }
      Promise.all(onceLoadedPromises).then(this.fulfillStorageLoad_);

      if (state.consent) {
        this.consent = state.consent;
      } else {
        log.error(
            'Error loading consent from storage for user ' + this.userId,
            state);
      }
    }

    public currentState = () :social.UserState => {
      return _.cloneDeep({
        name : this.name,
        imageData: this.profile.imageData,
        url: this.profile.url,
        instanceIds: Object.keys(this.instances_),
        consent: this.consent
      });
    }

    public handleLogout = () : void => {
      for (var instanceId in this.instances_) {
        this.instances_[instanceId].handleLogout();
      }
    }

    public sendInstanceHandshake = (clientId :string) : Promise<void> => {
      var myInstance = this.network.myInstance;
      if (!myInstance) {
        // TODO: consider waiting until myInstance is constructing
        // instead of dropping this message.
        // Currently we will keep receiving INSTANCE_REQUEST until instance
        // handshake is sent to the peer.
        log.error('Attempting to send instance handshake before ready');
        return;
      }
      // Ensure that the user is loaded so that we have correct consent bits.
      return this.onceLoaded.then(() => {
        var instanceMessage = {
          type: social.PeerMessageType.INSTANCE,
          data: {
            instanceId: myInstance.instanceId,
            description: globals.settings.description,
            consent: {
              isRequesting: this.consent.localRequestsAccessFromRemote,
              isOffering: this.consent.localGrantsAccessToRemote
            },
            name: myInstance.userName,
            userId: myInstance.userId,
            publicKey: globals.publicKey
          }
        };
        return this.network.send(this, clientId, instanceMessage);
      });
    }

    public resendInstanceHandshakes = () : void => {
      for (var instanceId in this.instanceToClientMap_) {
        var clientId = this.instanceToClientMap_[instanceId];
        this.sendInstanceHandshake(clientId);
      }
    }

    /**
     * Modify the consent for this instance, *locally*. (User clicked on one of
     * the consent buttons in the UI.) Sends updated consent bits to the
     * remote instance afterwards.  Returns a Promise which fulfills once
     * the consent has been modified.
     */
    public modifyConsent = (action :uproxy_core_api.ConsentUserAction) : Promise<void> => {
      var consentModified = this.onceLoaded.then(() => {
        if (!consent.handleUserAction(this.consent, action)) {
          return Promise.reject(new Error(
              'Invalid user action on consent ' +
              JSON.stringify({
                consent: this.consent,
                action: action
              })));
        }
      });

      // After consent has been modified, cancel connection if needed,
      // send new instance handshakes, save to storage, and update the UI.
      // We don't need callers to block on any of this, so we can just
      // return consentModified.
      consentModified.then(() => {
        // If remote is currently an active client, but user revokes access, also
        // stop the proxy session.
        if (uproxy_core_api.ConsentUserAction.CANCEL_OFFER === action) {
          for (var instanceId in this.instances_) {
            if (this.instances_[instanceId].localSharingWithRemote ==
                social.SharingState.SHARING_ACCESS) {
              this.instances_[instanceId].stopShare();
            }
          }
        }

        // Send new consent bits to all remote clients, and save to storage.
        for (var instanceId in this.instances_) {
          if (this.isInstanceOnline(instanceId)) {
            this.sendInstanceHandshake(this.instanceToClient(instanceId));
          }
        }

        this.saveToStorage();
        // Send an update to the UI.
        this.notifyUI();
      });

      return consentModified;
    }

    public updateRemoteRequestsAccessFromLocal = () => {
      // Set this.consent.remoteRequestsAccessFromLocal based on if any
      // instances are currently requesting access
      for (var instanceId in this.instances_) {
        if (this.instances_[instanceId].wireConsentFromRemote.isRequesting) {
          this.consent.remoteRequestsAccessFromLocal = true;
          return;
        }
      }
      this.consent.remoteRequestsAccessFromLocal = false;
    }

  }  // class User
