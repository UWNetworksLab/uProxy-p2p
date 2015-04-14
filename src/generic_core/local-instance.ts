/**
 * local-instance.ts
 *
 * This file defines the local uProxy Instance class. This represents the local
 * installation.
 */

import logging = require('../../../third_party/uproxy-lib/logging/logging');
import social_types = require('../interfaces/social');
import uproxy_types = require('../interfaces/uproxy');

module Core {
  var log :logging.Log = new logging.Log('local-instance');

  // Small convenience wrapper for random Uint8.
  //
  // TODO: gather up uses of random and put them into a common directory in
  // uproxy-lib, or directly use end-to-end implementation.
  export class LocalInstance
      implements uproxy_types.Instance, uproxy_types.Persistent {

    public instanceId  :string;
    public keyHash     :string;
    public clientId    :string;
    private imageData_ :string;
    private name_      :string;

    /**
     * Generate an instance for oneself, either from scratch or based on some
     * Instance state loaded from storage.
     *
     * Generating is required if one is running uProxy for the first time,
     * or without any available instance data, for one particular social
     * network.
     */
    public constructor(public network :social_types.Network,
                       public userId :string,
                       load ?:uproxy_types.Instance) {
      if (load) {
        this.restoreState(load);
        return;
      }
      this.instanceId = LocalInstance.generateInstanceID();
      this.keyHash = '';
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

    public updateProfile = (profile :uproxy_types.UserProfileMessage) :void => {
      this.name_ = profile.name;
      this.imageData_ = profile.imageData;
    }

    public getUserProfile = () :uproxy_types.UserProfileMessage => {
      return {
        userId: this.userId,
        name: this.name_,
        imageData: this.imageData_
      };
    }

    /**
     * TODO: Come up with a better typing for this.
     */
    public currentState = () :uproxy_types.Instance => {
      return {
        instanceId:  this.instanceId,
        keyHash:     this.keyHash,
      };
    }
    public restoreState = (state:uproxy_types.Instance) :void => {
      this.instanceId = state.instanceId;
      this.keyHash = state.keyHash;
    }

  }  // class Core.LocalInstance

}  // module Core
