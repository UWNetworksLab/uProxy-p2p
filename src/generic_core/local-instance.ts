/**
 * local-instance.ts
 *
 * This file defines the local uProxy Instance class. This represents the local
 * installation.
 */
/// <reference path='util.ts' />
/// <reference path='../interfaces/instance.d.ts' />
/// <reference path='../interfaces/persistent.d.ts' />
/// <reference path='../third_party/typings/webcrypto/WebCrypto.d.ts' />

module Core {
  var log :Logging.Log = new Logging.Log('local-instance');

  // Small convenience wrapper for random Uint8.
  //
  // TODO: gather up uses of random and put them into a common directory in
  // uproxy-lib, or directly use end-to-end implementation.
  export class LocalInstance implements Instance, Core.Persistent {

    public instanceId  :string;
    public keyHash     :string;
    public clientId    :string;

    /**
     * Generate an instance for oneself, either from scratch or based on some
     * Instance state loaded from storage.
     *
     * Generating is required if one is running uProxy for the first time,
     * or without any available instance data, for one particular social
     * network.
     */
    public constructor(public network :Social.Network,
                       public userId :string,
                       load ?:Instance) {
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
    public static generateInstanceID = () : string => {
      var hex, id = '';

      // TODO: check use of randomness: why not one big random number that is
      // serialised?
      for (var i = 0; i < 20; i++) {
        // 20 bytes for the instance ID.  This we can keep.
        hex = Math.floor(Math.random() * 256).toString(16);
        id += ('00'.substr(0, 2 - hex.length) + hex);
      }
      return id;
    }

    /**
     * This method prepares the local instance's handshake, to be sent to all
     * peers, notifying them that we are a uProxy installation.
     */
    public getInstanceHandshake = () : InstanceHandshake => {
      if (!this.keyHash) {
        log.warn('Local keyhash not ready');
      }
      return {
        instanceId:  this.instanceId,
        keyHash:     this.keyHash,
        description: core.globalSettings.description
      };
    }

    /**
     * TODO: Come up with a better typing for this.
     */
    public currentState = () : Instance => {
      return cloneDeep({
        instanceId:  this.instanceId,
        keyHash:     this.keyHash,
      });
    }
    public restoreState = (state) => {
      this.instanceId = state.instanceId;
      this.keyHash = state.keyHash;
    }

  }  // class Core.LocalInstance

}  // module Core
