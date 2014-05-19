/**
 * state-storage.ts
 *
 * Provides a promise-based interface to the storage provider.
 */
/// <reference path='util.ts' />
/// <reference path='../interfaces/instance.d.ts' />

/// <reference path='../../node_modules/freedom-typescript-api/interfaces/freedom.d.ts' />
/// <reference path='../../node_modules/freedom-typescript-api/interfaces/storage.d.ts' />
/// <reference path='../../node_modules/freedom-typescript-api/interfaces/promise.d.ts' />


module Core {

  var fStorage :freedom.Storage = freedom['storage']();  // Platform-independent provider.

  // Set false elsewhre to disable log messages (ie. from jasmine)
  export var DEBUG_STATESTORAGE = true;

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
     * Return an object containing all the relevant attributes of this class.
     */
    serialize :() => Object;

    /**
     * From a serialized string, update the object with the new attributes.
     * Serialize, and deserialize must map back and forth perfectly on the
     * attribues that were saved.
     */
    // deserialize :(json :string) => void;
  }

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

    // TODO: Move these into instance.
    /**
     * Promise loading all :Instances from storage.
     */
    /*
    public loadAllInstances = () : Promise<Instance[]> => {
      return this.load<string[]>(C.StateEntries.INSTANCEIDS, [])
          .then((instanceIds:string[]) => {
            var loadedInstances: Promise<Instance>[] = [];
            dbg('Loading Instance IDs: ', instanceIds);
            // Load each instance in instance IDs.
            loadedInstances = instanceIds.map((id) => { return this.loadInstanceFromId(id); });
            return Promise.all(loadedInstances).then(() => {
              dbg('Loaded ' + loadedInstances.length + ' instances.');
              return loadedInstances;
            });
          });
    } */

    /**
     * Save |instance| for |instanceId| to local storage.
     * Assumes that both the Instance notification and XMPP user and client
     * information exist and are up-to-date.
     *
     * |instanceId| - instance identifier (40-char hex string)
     * TODO: Fix the Promise<any> once the typescript interface for Promises
     * deals with Promise.reject the right way.
     */
    /*
    public saveInstance = (instanceId:string) : Promise<any> => {
      if (!(instanceId in this.state.instances)) {
        console.warn('Attempted to save nonexisting instance: ' + instanceId);
        return Promise.reject(new Error('no instance'));
      }
      // TODO: optimize to only save when different to what was in storage;
      var savedKeys: Promise<string>[] = [];
      savedKeys.push(this.saveKeyAsJson_(
          C.StateEntries.INSTANCEIDS,
          Object.keys(this.state[C.StateEntries.INSTANCES])));
      var instance = this.state.instances[instanceId];
      // Be obscenely strict here, to make sure we don't propagate buggy
      // state across runs (or versions) of UProxy.
      // TODO: make this a type!
      var instanceDataToSave = {
        // Instance stuff:
        // annotation: getKeyWithDefault(instanceInfo, 'annotation',
        //    instanceInfo.description),
        instanceId: instanceId,
        keyHash: instance.keyHash,
        trust: instance.trust,
        // Overlay protocol used to get descriptions.
        description: instance.description,
        notify: Boolean(instance.notify),
        rosterInfo: instance.rosterInfo
      };
      dbg('saveInstance: saving \'instance/' + instanceId + ' \'',
                  JSON.stringify(instanceDataToSave));
      savedKeys.push(this.saveKeyAsJson_(
          'instance/' + instanceId,
          instanceDataToSave));
      return Promise.all(savedKeys).then(() => {
        dbg('Saved instance ' + instanceId);
      });
    }
    */

    /**
     * Save all :Instances to local storage.
     */
     /*
    public saveAllInstances = () : Promise<string[]> => {
      var instanceIds :string[] = Object.keys(
          this.state[C.StateEntries.INSTANCES]);
      var savedData :Promise<any>[] = instanceIds.map(this.saveInstance);
      // Re-write the instanceId table. This is necessary in case of some
      // instanceIds were removed.
      savedData.push(this.saveKeyAsJson_(
          C.StateEntries.INSTANCEIDS, instanceIds));
      return Promise.all(savedData);
    }
    */


    // --------------------------------------------------------------------------
    //  Whole state
    // --------------------------------------------------------------------------

    // TODO: Move this to the Network
    /**
     * Load all aspects of the state concurrently, from storage.
     */
    // public loadStateFromStorage = () : Promise<void> => {
      // this.state = restrictKeys(C.DEFAULT_LOAD_STATE, this.state);
      // var loadedState: Promise<any>[] = [];
      // loadedState.push(this.loadMeFromStorage());
      // loadedState.push(this.loadOptionsFromStorage());
      // loadedState.push(this.loadAllInstances());
      // return Promise.all(loadedState).then(() => {
        // dbg('Finished loading state from storage.');
      // });
    // }

    /**
     * Save all aspects of the state concurrently, to storage.
     */
    // public saveStateToStorage = () : Promise<void> => {
      // var savedState: Promise<any>[] = [];
      // savedState.push(this.saveMeToStorage());
      // savedState.push(this.saveOptionsToStorage());
      // savedState.push(this.saveAllInstances());
      // return Promise.all(savedState).then(() => {
        // dbg('Finished saving state to storage.');
      // });
    // }

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
