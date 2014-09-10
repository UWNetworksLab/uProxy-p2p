/**
 * storage.ts
 *
 * Provides a promise-based interface to the storage provider.
 */
/// <reference path='util.ts' />
/// <reference path='../interfaces/instance.d.ts' />
/// <reference path='../interfaces/persistent.d.ts' />

/// <reference path='../freedom/typings/freedom.d.ts' />
/// <reference path='../freedom/typings/storage.d.ts' />
/// <reference path='../third_party/typings/es6-promise/es6-promise.d.ts' />


module Core {

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
        dbg('Cleared all keys from storage.');
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
      this.log('loading ' + key);
      return fStorage.get(key).then((result :string) => {
        this.log('Loaded [' + key + '] : ' + result);
        return <T>JSON.parse(result);
      }, (e) => {
        this.log(e.message);
        return <T>{};
      });
    }

    /**
     * Promise saving a key-value pair to storage, fulfilled with the previous
     * value of |key| if it existed (according to the freedom interface.)
     */
    // TODO: should not return a value in the promise. Should be Promise<void>
    public save = <T>(key :string, val :T) : Promise<T> => {
      this.log('Saving ' + key + ': ' + val);
      return fStorage.set(key, JSON.stringify(val)).then((prev:string) => {
        this.log('Saved to storage[' + key + ']. old val=' + prev);
        if (!prev) {
          return undefined;
        }
        return <T>JSON.parse(prev);
      }).catch((e) => {
        this.log(e.message);
        return <T>{};
      });
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

    private log = (msg:string) => {
      if (DEBUG_STATESTORAGE) {
        console.log('[Storage] ' + msg);
      }
    }
  }  // class Storage


  // TODO: Make logging better.
  var modulePrefix_ = '[Storage] ';
  var dbg = (...args:any[]) => { dbg_(console.log, args); }
  var dbgWarn = (...args:any[]) => { dbg_(console.warn); }
  var dbgErr = (...args:any[]) => { dbg(console.error); }
  var dbg_ = (logger, ...args:any[]) => {
    if (!DEBUG_STATESTORAGE) {
     return;
    }
    logger.apply(Core, [modulePrefix_].concat(args));
  }


}  // module Core
