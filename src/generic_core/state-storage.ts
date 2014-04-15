/**
 * State storage.
 * To see the format used by localstorage, see the file:
 *   scraps/local_storage_example.js
 */
/// <reference path='../../node_modules/freedom-typescript-api/interfaces/freedom.d.ts' />
/// <reference path='../../node_modules/freedom-typescript-api/interfaces/promise.d.ts' />
/// <reference path='constants.ts' />

declare var cloneDeep:any;
declare var adjectives:any;
declare var nouns:any;
declare var FinalCallback:any;
declare var restrictKeys:any;
declare var isDefined:any;

// TODO: Fully type the 'instance', move into a .d.ts file, and utilize
// throughout the rest of uProxy.
interface Instance {
  status: string;
}

module Core {

  var fStorage = freedom['storage']();  // Platform-independtn storage provider.

  // Set false elsewhre to disable log messages (ie. from jasmine)
  export var DEBUG_STATESTORAGE = true;

  /**
   * Contains all state for uProxy's core.
   */
  export class State {

    public state: any;

    constructor() {
      this.state = cloneDeep(C.DEFAULT_LOAD_STATE);
    }

    /**
     * Resets state, and clears local storage.
     */
    public reset = () : Promise<void> => {
      return new Promise<void>((F, R) => {
        fStorage.clear().done(F);
      }).then(() => {
        dbg('Cleared storage, now loading again...');
        this.state = cloneDeep(C.DEFAULT_LOAD_STATE);
        return this.loadStateFromStorage();
      });
    }

    // --------------------------------------------------------------------------
    // Promise-based wrappers for Freedom storage API to work with json instead
    // of strings.

    /**
     * Promise loading a key from storage, as a JSON object.
     * Use Generic <T> to indicate the type of the returned object.
     *
     * TODO: Consider using a storage provider that works with JSON.
     */
    private loadKeyAsJson_ = <T>(key, defaultIfUndefined?) : Promise<T> => {
      return new Promise<string>((F, R) => {
        fStorage.get(key).done(F);
      }).then((result) => {
        // dbg('Loaded from storage[' + key + '] (type: ' +
                    // (typeof result) + '): ' + result);
        if (isDefined(result)) {
          return <T>JSON.parse(result);
        } else {
          return <T>defaultIfUndefined;
        }
      });
    }

    /**
     * Promise saving a key-value pair to storage, fulfilled with the previous
     * value of |key| if it existed (according to the freedom interface.)
     */
    private saveKeyAsJson_ = (key:string, val:any) : Promise<string>=> {
      return new Promise<string>((F, R) => {
        fStorage.set(key, JSON.stringify(val)).done(F);
      }).then((val:string) => {
        // dbg('Saved to storage[' + key + ']. old val=' + val);
        return val;
      });
    }

    /**
     * If one is running UProxy for the first time, or without any available
     * instance data, generate an instance for oneself.
     */
    private generateMyInstance_ = () => {
      var i, val, hex, id, key;

      var me = cloneDeep(C.DEFAULT_LOAD_STATE.me);

      // Create an instanceId if we don't have one yet.
      // Just generate 20 random 8-bit numbers, print them out in hex.
      //
      // TODO: check use of randomness: why not one big random number that is
      // serialised?
      for (i = 0; i < 20; i++) {
        // 20 bytes for the instance ID.  This we can keep.
        val = Math.floor(Math.random() * 256);
        hex = val.toString(16);
        me.instanceId = me.instanceId +
            ('00'.substr(0, 2 - hex.length) + hex);

        // 20 bytes for a fake key hash. TODO(mollyling): Get a real key hash.
        val = Math.floor(Math.random() * 256);
        hex = val.toString(16);

        me.keyHash = ((i > 0)? (me.keyHash + ':') : '')  +
            ('00'.substr(0, 2 - hex.length) + hex);

        // TODO: separate this out and use full space of possible names by
        // using the whole of the available strings.
        if (i < 4) {
          id = (i & 1) ? nouns[val] : adjectives[val];
          if (me.description !== null && me.description.length > 0) {
            me.description = me.description + ' ' + id;
          } else {
            me.description = id;
          }
        }
      }
      return me;
    }

    /**
     * A simple predicate function to see if we can talk to this client.
     * TODO: remove with the new social presence indicators.
     */
    public isMessageableUproxyClient = (client) => {
      return 'messageable' == client.status;
    }

    // --------------------------------------------------------------------------
    //  Users's profile for this instance
    // --------------------------------------------------------------------------

    /**
     * Saving your 'me' state involves saving all fields that are state.me & that
     * are in the C.DEFAULT_SAVE_STATE.
     * TODO: Fulfill with a conversion from string to the instance type.
     */
    public saveMeToStorage = () : Promise<string> => {
      return this.saveKeyAsJson_(
          C.StateEntries.ME,
          restrictKeys(C.DEFAULT_SAVE_STATE.me, this.state.me));
    }

    /**
     * Load 'me' from storage, or generate a new instance.
     * TODO: Type loadKeyAsJson_ with the 'me' instance type.
     */
    public loadMeFromStorage = () : Promise<any> => {
      return this.loadKeyAsJson_(C.StateEntries.ME, null).then((me) => {
        if (null === me) {
          this.state.me = this.generateMyInstance_();
          dbg('****** Saving new self-definition *****');
          dbg('  state.me = ' + JSON.stringify(this.state.me));
          return this.saveMeToStorage();
        } else {
          dbg('++++++ Loaded self-definition ++++++');
          dbg('  state.me = ' + JSON.stringify(me));
          this.state.me = restrictKeys(this.state.me, me);
          return me;
        }
      });
    }

    // --------------------------------------------------------------------------
    //  Options
    // --------------------------------------------------------------------------
    public saveOptionsToStorage = () : Promise<string> => {
      return this.saveKeyAsJson_(
          C.StateEntries.OPTIONS,
          restrictKeys(C.DEFAULT_SAVE_STATE.options, this.state.options));
    }

    public loadOptionsFromStorage = () : Promise<void> => {
      return this.loadKeyAsJson_(C.StateEntries.OPTIONS, {}).then((loadedOptions) => {
        this.state.options =
            restrictKeys(cloneDeep(C.DEFAULT_LOAD_STATE.options), loadedOptions);
      });
    }

    // --------------------------------------------------------------------------
    //  Syncronizing Instances
    // --------------------------------------------------------------------------
    // Give back the instance from a user ID (currently by searching through all
    // user ids)
    // TODO: consider creating a userId <-> instanceId multi-mapping.
    public instanceOfUserId = (userId) => {
      for (var i in this.state.instances) {
        if (this.state.instances[i].rosterInfo.userId == userId)
          return this.state.instances[i];
      }
      return null;
    }

    /**
     * Should be called whenever an instance is created/loaded.
     * Assumes that instance corresponding to |instanceId| has a userId.
     * Although the user doesn't need to currently be in the roster - this
     * function will add to the roster if the userId is not already present.
     */
    public syncRosterFromInstanceId = (instanceId:string) : void => {
      var instance = this.state.instances[instanceId];
      var userId = instance.rosterInfo.userId;
      var user = this.state.roster[userId];

      // Extrapolate the user & add to the roster.
      if (!user) {
        // TODO: do proper reconciliation: probably do a diff check, and
        // maybe update instance.modify.
        this.state.roster[userId] = {};
        user = this.state.roster[userId];
        user.clients = {};
        user.userId = userId;
        user.name = instance.rosterInfo.name;
        user.network = instance.rosterInfo.network;
        user.url = instance.rosterInfo.url;
        user.hasNotification = Boolean(instance.notify);
      }
    }

    /**
     * Called when a new userId is available, and when receiving new instances.
     * TODO: Update when using new social API structured roster.
     * - Check if we need to update instance information.
     * - Assumes that instance already exists for this |userId|.
     */
    public syncInstanceFromInstanceMessage =
        (userId:string, clientId:string, data) : void => {
      var instanceId = data.instanceId;
      // Some local metadata isn't transmitted.  Add it in.
      data = restrictKeys(C.DEFAULT_INSTANCE, data);

      // Before everything, remember the clientId - instanceId relation.
      var oldClientId = this.state.instanceToClient[instanceId];
      this.state.clientToInstance[clientId] = instanceId;
      this.state.instanceToClient[instanceId] = clientId;

      // Obsolete client will never have further communications.
      if (oldClientId && (oldClientId != clientId)) {
        dbg('Deleting obsolete client ' + oldClientId);
        var user = this.state.roster[userId];
        if (user) {
          delete user.clients[oldClientId];
        } else {
          console.error('Warning: no user for ' + userId);
        }
        delete this.state.clientToInstance[oldClientId];
      }

      // Prepare new instance object if necessary.
      var instance = this.state.instances[instanceId];
      if (!instance) {
        dbg('Preparing NEW Instance... ');
        instance = cloneDeep(C.DEFAULT_INSTANCE);
        instance.instanceId = data.instanceId;
        instance.keyHash = data.keyHash;
        this.state.instances[instanceId] = instance;
      }
      instance.rosterInfo = data.rosterInfo;
      instance.rosterInfo.userId = userId;
      instance.description = data.description;

      this.syncRosterFromInstanceId(instanceId);
    }

    // --------------------------------------------------------------------------
    //  Loading & Saving Instances
    // --------------------------------------------------------------------------

    /**
     * Load :Instance corresponding to |instanceId| from storage.
     */
    public loadInstanceFromId = (instanceId:string) : Promise<Instance> => {
      return this.loadKeyAsJson_<Instance>('instance/' + instanceId, null)
          .then((instance:Instance) => {
        if (!instance) {
          return Promise.reject(new Error(
              'Load error: instance ' + instanceId + ' not found.'));
        } else {
          dbg('instance ' + instanceId + ' loaded');
          instance.status = cloneDeep(C.DEFAULT_PROXY_STATUS);
          this.state.instances[instanceId] = instance;
          this.syncRosterFromInstanceId(instanceId);
        }
        return Promise.resolve(instance);
      });
    }

    /**
     * Promise loading all :Instances from storage.
     */
    public loadAllInstances = () : Promise<Instance[]> => {
      return this.loadKeyAsJson_<string[]>(C.StateEntries.INSTANCEIDS, [])
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
    }

    /**
     * Save |instance| for |instanceId| to local storage.
     * Assumes that both the Instance notification and XMPP user and client
     * information exist and are up-to-date.
     *
     * |instanceId| - instance identifier (40-char hex string)
     * TODO: Fix the Promise<any> once the typescript interface for Promises
     * deals with Promise.reject the right way.
     */
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

    /**
     * Save all :Instances to local storage.
     */
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


    // --------------------------------------------------------------------------
    //  Whole state
    // --------------------------------------------------------------------------

    /**
     * Load all aspects of the state concurrently, from storage.
     */
    public loadStateFromStorage = () : Promise<void> => {
      this.state = restrictKeys(C.DEFAULT_LOAD_STATE, this.state);
      var loadedState: Promise<any>[] = [];
      loadedState.push(this.loadMeFromStorage());
      loadedState.push(this.loadOptionsFromStorage());
      loadedState.push(this.loadAllInstances());
      return Promise.all(loadedState).then(() => {
        dbg('Finished loading state from storage.');
      });
    }

    /**
     * Save all aspects of the state concurrently, to storage.
     */
    public saveStateToStorage = () : Promise<void> => {
      var savedState: Promise<any>[] = [];
      savedState.push(this.saveMeToStorage());
      savedState.push(this.saveOptionsToStorage());
      savedState.push(this.saveAllInstances());
      return Promise.all(savedState).then(() => {
        dbg('Finished saving state to storage.');
      });
    }

  }  // class State


  // TODO: Make logging better.
  var modulePrefix_ = '[StateStorage] ';
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
