// Typescript file for:
// freedom/interface/storage.js
//
// Typescript definitions for the Freedom Storage API.

/// <reference path="../../third_party/typings/es6-promise/es6-promise.d.ts" />

//declare module freedom {
  declare module freedom_Storage {
    // TODO: would be nice for freedom to have better constants/enum interface.
    var SCOPE :{
      SESSION :string;
      DEVICE_LOCAL :string;
      USER_LOCAL :string;
      SHARED :string;
    }
  }

// The Freedom Storage class
  interface freedom_Storage {
    // Fetch array of all keys.
    keys() : string[];
    // Fetch a value for a key.
    get(key :string) : Promise<string>;
    // Sets a value to a key. Fulfills promise with the previous value, if it
    // exists.
    set(key :string, value :string) : Promise<string>;
    // Remove a single key. Fulfills promise with previous value, if exists.
    remove(key :string) : Promise<string>;
    // Remove all data from storage.
    clear() : Promise<void>;
  }  // class Storage

//}  // declare module Freedom
