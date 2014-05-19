/**
 * local-instance.ts
 *
 * This file defines the local uProxy Instance class. This represents the local
 * installation.
 */
/// <reference path='nouns-and-adjectives.ts' />
/// <reference path='../interfaces/instance.d.ts' />

module Core {

  export class LocalInstance implements Instance, Core.Persistent {

    public instanceId  :string;
    public description :string;
    public keyHash     :string;
    public userId      :string;

    /**
     * Generate an instance for oneself, either from scratch or based on some
     * Instance state loaded from storage.
     *
     * Generating is required if one is running uProxy for the first time,
     * or without any available instance data, for one particular social
     * network.
     */
    public constructor(public network :Social.Network, load ?:Instance) {
      if (load) {
        this.deserialize(load);
        return;
      }
      this.instanceId = LocalInstance.generateInstanceID();
      this.description = this.generateRandomDescription_();
      this.keyHash = this.generateKeyHash();
      console.log('Generated LocalInstance: ',
          this.instanceId,
          this.description,
          this.keyHash);
    }

    /**
     * Obtain storag prefix for the LocalInstance.
     */
    public getStorePath = () => {
      return this.network.getStorePath() + 'me';
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

    // TODO: Get a real key hash.
    public generateKeyHash = () : string => {
      var keyHash = '';
      var hex :String;
      for (var i = 0; i < 20; i++) {
        // 20 bytes for a fake key hash.
        hex = Math.floor(Math.random() * 256).toString(16);
        keyHash = ((i > 0)? (keyHash + ':') : '')  +
            ('00'.substr(0, 2 - hex.length) + hex);
      }
      return keyHash;
    }

    /**
     * Generate a random description based on an instance ID.
     */
    private generateRandomDescription_ = () : string => {
      var words :string[] = [];
      // TODO: separate this out and use full space of possible names by
      // using the whole of the available strings.
      for (var i = 0; i < 4; i++) {
        var index= Math.floor(Math.random() * 256);
        words.push((i & 1) ? nouns[index] : adjectives[index]);
      }
      return words.join(' ');
    }

    /**
     * Update this local instance's description.
     */
    public updateDescription = (description:string) => {
      this.description = description;
      // TODO: save personal description to storage.
      // TODO: Send the new description to ALL currently online friend instances.
    }

    /**
     * This method prepares the local instance's handshake, to be sent to all
     * peers, notifying them that we are a uProxy installation.
     */
    public getInstanceHandshake = () : InstanceHandshake => {
      return {
        instanceId:  this.instanceId,
        keyHash:     this.keyHash,
        description: this.description
      };
    }

    /**
     * Return JSON object of self, which can be serialized.
     * TODO: Come up with a better typing for this.
     */
    public serialize = () : Instance => {
      return {
        instanceId:  this.instanceId,
        description: this.description,
        keyHash:     this.keyHash,
      };
    }
    public deserialize = (json) => {
      this.instanceId = json.instanceId;
      this.description = json.description;
      this.keyHash = json.keyHash;
    }

  }  // class Core.LocalInstance

}  // module Core
