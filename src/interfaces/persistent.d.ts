declare module Core {

  /**
   * Classes which make use of Storage should implement a consistent
   * interface for accessing the Storage object.
   */
  export interface Persistent {

    /**
     * Returns the prefix string for saving / loading the class from storage.
     * Use slash-delimination.
     * Expected: This function should return a string that ends with a /, for
     * further path appending.
     */
    getStorePath :() => string;

    /**
     * Returns an object containing all the relevant attributes of this class.
     * This returns an Object and not a string because JSON parse/stringify
     * occurs only at the message-passing layer. If it occured at this
     * interface, then there would be a lot of messy JSON code in every class
     * which implemented Core.Persistent.
     */
    serialize :() => Object;

    /**
     * From the serialized attribute object, update with the new attributes.
     * Serialize and deserialize must map back and forth perfectly on the
     * attribues that were saved.
     */
    deserialize :(json :Object) => void;

  }  // interface Core.Persistent

}  // module Core
