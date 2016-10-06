/**
 * Represents an entity whose state can be captured and restored, such as
 * with storage in a repository and subsequent retrieval.
 *
 * The interface represents state as an object, not as JSON text. JSON
 * serialization, if appropriate, occurs outside of this interface.
 */
interface Persistent {

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
   *
   * Implementations MUST return objects that they will never again mutate.
   * All of the returned object's proeprty values must be of primitive types
   * or be deep copies. The reason is that callers expect the returned value
   * to be an unchanging representation of the state at the time
   * 'currentState' was called. For example, if an implementation simply sets
   * a property "foo" to the instance member 'foo_' of array type, then when
   * 'foo_' is mutated in the future states previously returned from
   * 'currentState' will also change, violating this interface's contract
   * and likely causing subtle breakage.
   */
  currentState :() => Object;

  /**
   * Updates the state of 'this' to match 'state'.
   */
  restoreState :(state :Object) => void;

}  // interface Persistent

export default Persistent;
