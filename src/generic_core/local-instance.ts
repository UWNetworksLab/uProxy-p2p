/**
 * local-instance.ts
 *
 * This file defines the local uProxy Instance class. This represents the local
 * installation.
 */

import globals = require('./globals');
import logging = require('../../../third_party/uproxy-lib/logging/logging');
import Persistent = require('../interfaces/persistent');
import social = require('../interfaces/social');

import storage = globals.storage;

// module Core {
  var log :logging.Log = new logging.Log('local-instance');

  // Small convenience wrapper for random Uint8.
  //
  // TODO: gather up uses of random and put them into a common directory in
  // uproxy-lib, or directly use end-to-end implementation.
  export class LocalInstance implements social.LocalInstanceState, Persistent {

    public instanceId :string;
    public clientId :string;
    public userName :string;
    public imageData :string;
    public invitePermissionTokens :{ [token :string] :social.PermissionTokenInfo } = {};

    /**
     * Generate an instance for oneself, either from scratch or based on some
     * Instance state loaded from storage.
     *
     * Generating is required if one is running uProxy for the first time,
     * or without any available instance data, for one particular social
     * network.
     */
    public constructor(public network :social.Network,
                       public userId :string,
                       load ?:social.LocalInstanceState) {
      if (load) {
        this.restoreState(load);
        return;
      }
      this.instanceId = LocalInstance.generateInstanceID();
    }

    /**
     * Obtain storage prefix for the LocalInstance.
     */
    public getStorePath = () => {
      return this.network.name + this.userId;
    }

    /**
     * Computes an instanceId if we don't have one yet.
     * Just generate 20 random 8-bit numbers, print them out in hex.
     */
    public static generateInstanceID = () :string => {
      var hex :string;
      var id :string = '';

      // TODO: check use of randomness: why not one big random number that is
      // serialised?
      for (var i = 0; i < 20; i++) {
        // 20 bytes for the instance ID.  This we can keep.
        // TODO: don't use Math.random; use uproxy crypto. (security higene)
        hex = Math.floor(Math.random() * 256).toString(16);
        id += ('00'.substr(0, 2 - hex.length) + hex);
      }
      return id;
    }

    public updateProfile = (profile :social.UserProfileMessage) :void => {
      this.userName = profile.name;
      this.imageData = profile.imageData;
      this.saveToStorage();
    }

    public getUserProfile = () :social.UserProfileMessage => {
      return {
        userId: this.userId,
        name: this.userName,
        imageData: this.imageData
      };
    }

    /**
     * TODO: Come up with a better typing for this.
     */
    public currentState = () :social.LocalInstanceState => {
      return {
        instanceId: this.instanceId,
        userId: this.userId,
        userName: this.userName,
        imageData: this.imageData,
        invitePermissionTokens: this.invitePermissionTokens
      };
    }
    public restoreState = (state:social.LocalInstanceState) :void => {
      this.instanceId = state.instanceId;
      if (typeof this.userName === 'undefined') {
        this.userName = state.userName;
        this.imageData = state.imageData;
      }
      if (typeof state.invitePermissionTokens !== 'undefined') {
        this.invitePermissionTokens = state.invitePermissionTokens;
      }
    }

    public saveToStorage = () :Promise<void> => {
      return storage.save(this.getStorePath(), this.currentState())
          .catch((e:Error) => {
        log.error('Could not save new LocalInstance: ',
            this.instanceId, e.toString());
      });
    }

    public generateInvitePermissionToken = (isRequesting :boolean, isOffering :boolean) : string => {
      if (!isRequesting && !isOffering) {
        // sanity check
        throw Error('Not generating permission token with !isRequesting && !isOffering');
      }
      var permissionToken = String(Math.random());
      this.invitePermissionTokens[permissionToken] = {
        isRequesting: isRequesting,
        isOffering: isOffering,
        createdAt: Date.now()
      };
      this.saveToStorage();
      return permissionToken;
    }

  }  // class local_instance.LocalInstance

// }  // module Core
