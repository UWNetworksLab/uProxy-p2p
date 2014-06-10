declare module Core {

  /**
   * Represents an entity whose state can be captured and restored, such as
   * with storage in a repository and subsequent retrieval.
   *
   * The interface represents state as an object, not as JSON text. JSON
   * serialization, if appropriate, occurs outside of this interface.
   */
  export interface Persistent {

    /**
     * Returns the prefix string for saving / loading the object from storage.
     * Paths are slash-delimited.
     *
     * Expected: This function should return a string that ends with a /, for
     * further path appending.
     *
     * TODO: Why is the string a "prefix"? How is the prefix related to the
     * location at which the entity will be stored? What "appending" might
     * occur, and how is it related to implementations of this interface? Why
     * are persistent entities concerned with where they are stored?
     *
     * TODO: Consider removing this method. The issue of storage paths applies
     * only to saving & loading, but this interface is not involved in saving
     * or loading.
     */
    getStorePath :() => string;

    /**
     * Returns an object that encapsulates the state of the 'this' object.
     * There are no requirements regarding the content of the returned object,
     * except that it must be one that restoreState() is able to consume.
     */
    stateSnapshot :() => Object;

    /**
     * Updates the state of 'this' to match 'state'.
     */
    restoreState :(state :Object) => void;

  }  // interface Core.Persistent

}  // module Core
