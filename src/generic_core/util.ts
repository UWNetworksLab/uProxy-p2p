/**
 * util.ts
 *
 * This file contains helpers for the uProxy Core.
 */

/**
 * Given an array or object, returns a deep copy. Given a primitive type,
 * returns the input unchanged (since such values are immutable).
 *
 * When cloning objects, copies only enumerable properties.
 *
 * Reference handling:
 *   - Does not attempt to handle cyclical references correctly.
 *   - Creates a new copy for each occurrence of a reference. Every reference
 *     in the output will be unique, even if the input contains multiple
 *     identical references.
 *
 * Throws an exception if asked to clone a function.
 */
function cloneDeep(val) {
  // Handle null separately, since typeof null === 'object'.
  if (val === null) {
    return null;
  }

  switch (typeof val) {
    case 'boolean':
      // fallthrough intended
    case 'number':
      // fallthrough intended
    case 'string':
      return val;

    case 'undefined':
      return undefined;

    case 'object': {
      if (Array.isArray(val)) {
        var arrayClone = new Array(val.length);
        for (var i = 0; i < val.length; i++) {
          arrayClone[i] = cloneDeep(val[i]);
        }
        return arrayClone;
      } else {
        var objectClone = {};
        for (var propertyName in val) {
          objectClone[propertyName] = cloneDeep(val[propertyName]);
        }
        return objectClone;
      }
    }

    case 'function':
      throw new Error('Functions cannot be cloned');
    default:
      throw new Error('Unsupported input type [' + (typeof val) + ']');
  }
}
