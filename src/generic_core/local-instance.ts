/**
 * local-instance.ts
 *
 * This file defines the local uProxy Instance class. This represents the local
 * installation.
 */
/// <reference path='nouns-and-adjectives.ts' />

module Core {

  export class LocalInstance implements Instance {

    public instanceId  :string;
    public description :string;
    public keyHash     :string;

    /**
     * Generate an isntance for oneself.
     * This is generally required if one is running uProxy for the first time,
     * or without any available instance data, for one particular social
     * network.
     */
    public constructor() {
      this.instanceId = LocalInstance.generateInstanceID();
      this.description = this.generateRandomDescription_();
      this.keyHash = this.generateKeyHash();
      console.log('Generated LocalInstance: ',
          this.instanceId,
          this.description,
          this.keyHash);
    }

    /**
     * Computes an instanceId if we don't have one yet.
     * Just generate 20 random 8-bit numbers, print them out in hex.
     */
    public static generateInstanceID = () : string => {
      var hex, id;
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
    public getInstanceHandshake = () => {
      // TODO.
    }

  }  // class Core.LocalInstance

}  // module Core
