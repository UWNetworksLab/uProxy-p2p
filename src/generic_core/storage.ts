/**
 * storage.ts
 *
 * Provides a promise-based interface to the storage provider.
 */
/// <reference path='../../../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../../third_party/freedom-typings/freedom-module-env.d.ts' />
/// <reference path='../../../third_party/freedom-typings/storage.d.ts' />

import Persistent = require('../interfaces/persistent');

  var log :logging.Log = new logging.Log('storage');

  // Platform-independent storage provider.
  var fStorage :freedom_Storage = freedom['storage']();

  // Set false elsewhere to disable log messages (ie. from jasmine)
  export var DEBUG_STATESTORAGE = true;

  /**
   * Contains all state for uProxy's core.
   */
  export class Storage {

    /**
     * Resets state, and clears local storage.
     */
    public reset = () : Promise<void> => {
      return fStorage.clear().then(() => {
        log.info('Cleared all keys from storage');
        // TODO: Determine if we actually need any 'initial' state.
      });
    }

    // --------------------------------------------------------------------------
    // Promise-based wrappers for Freedom storage API to work with json instead
    // of strings.

    /**
     * Promise loading a key from storage, as a JSON object.
     * Use Generic <T> to indicate the type of the returned object.
     * If the key does not exist, rejects the promise.
     *
     * TODO: Consider using a storage provider that works with JSON.
     * TODO: Really reject the promise!
     */
    public load = <T>(key :string) : Promise<T> => {
      log.debug('loading', key);
      return fStorage.get(key).then((result :string) => {
        if (typeof result === 'undefined' || result === null) {
          return Promise.reject('non-existing key');
        }
        log.debug('Loaded [%1]: %2', key, result);
        return <T>JSON.parse(result);
      });
    }

    /**
     * Promise saving a key-value pair to storage, fulfilled with the previous
     * value of |key| if it existed (according to the freedom interface.)
     */
    // TODO: should not return a value in the promise. Should be Promise<void>
    public save = <T>(key :string, val :T) : Promise<T> => {
      log.debug('Saving to storage', {
        key: key,
        newVal: val
      });
      return fStorage.set(key, JSON.stringify(val)).then((prev:string) => {
        log.debug('Successfully saved to storage', {
          key: key,
          oldVal: prev
        });
        if (!prev) {
          return undefined;
        }
        return <T>JSON.parse(prev);
      }).catch((e) => {
        log.error('Save operation failed', e.message);
        return <T>{};
      });
    }

    public keys = () : Promise<string[]> => {
      return fStorage.keys();
    }

    // --------------------------------------------------------------------------
    //  Options
    // TODO: Move options to its own class and fix it.
    // --------------------------------------------------------------------------
    /*
    public saveOptionsToStorage = () : Promise<string> => {
      return this.save(
          C.StateEntries.OPTIONS,
          null);
          // restrictKeys(C.DEFAULT_SAVE_STATE.options, this.state.options));
    }

    public loadOptionsFromStorage = () : Promise<void> => {
      return this.load(C.StateEntries.OPTIONS, {}).then((loadedOptions) => {
        dbg('loaded options: ' + loadedOptions);
        // this.state.options =
            // restrictKeys(cloneDeep(C.DEFAULT_LOAD_STATE.options), loadedOptions);
      });
    }
    */
  }  // class Storage
