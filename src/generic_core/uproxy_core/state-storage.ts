/**
 * State storage.
 * To see the format used by localstorage, see the file:
 *   scraps/local_storage_example.js
 */
/// <reference path='../../../node_modules/freedom-typescript-api/interfaces/freedom.d.ts' />
/// <reference path='../../../node_modules/freedom-typescript-api/interfaces/promise.d.ts' />
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

  var fStorage = freedom['storage']();  // PLatform-independtn storage provider.

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
        console.log('Cleared storage, now loading again...');
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
        console.log('Loaded from storage[' + key + '] (type: ' +
                    (typeof result) + '): ' + result);
        if (isDefined(result)) {
          return Promise.resolve(JSON.parse(result));
        } else {
          return Promise.resolve(defaultIfUndefined);
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
          console.log('****** Saving new self-definition *****');
          console.log('  state.me = ' + JSON.stringify(this.state.me));
          return this.saveMeToStorage();
        } else {
          console.log('++++++ Loaded self-definition ++++++');
          console.log('  state.me = ' + JSON.stringify(me));
          this.state.me = restrictKeys(this.state.me, me);
          return Promise.resolve(me);
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
        console.log('Deleting obsolete client ' + oldClientId);
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
        console.log('Preparing NEW Instance... ');
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
     * Promise the load of an :Instance corresponding to |instanceId|.
     */
    public loadInstanceFromId = (instanceId:string) : Promise<Instance> => {
      return this.loadKeyAsJson_<Instance>('instance/' + instanceId, null)
          .then((instance:Instance) => {
        if (!instance) {
          return Promise.reject(new Error(
              'Load error: instance ' + instanceId + ' not found.'));
        } else {
          console.log('instance ' + instanceId + ' loaded');
          instance.status = cloneDeep(C.DEFAULT_PROXY_STATUS);
          this.state.instances[instanceId] = instance;
          this.syncRosterFromInstanceId(instanceId);
        }
        return Promise.resolve(instance);
      });
    }

    /**
     * Load all instances from storage. Takes in a FinalCallbacker to make sure
     * that the desired callback is called when the last instance is loaded.
     */
    public loadAllInstances = () : Promise<Instance[]> => {
      return this.loadKeyAsJson_<string[]>(C.StateEntries.INSTANCEIDS, [])
          .then((instanceIds:string[]) => {
            var loadedInstances: Promise<Instance>[] = [];
            console.log('Loading Instance IDs: ', instanceIds);
            // Load each instance in instance IDs.
            loadedInstances = instanceIds.map(this.loadInstanceFromId);
            return Promise.all(loadedInstances);
          });
    }

    /**
     * Promise that |instance| for |instanceId| is saved to local storage.
     * Assumes that both the Instance notification and XMPP user and client
     * information exist and are up-to-date.
     *
     * |instanceId| - string instance identifier (a 40-char hex string)
     */
    public saveInstance = (instanceId:string) : Promise<any> => {
      if (!(instanceId in this.state.instances)) {
        console.warn('Attempted to save nonexisting instance: ' + instanceId);
        return;
      }
      // TODO: optimise to only save when different to what was in storage;
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
      console.log('saveInstance: saving \'instance/\'' + instanceId,
                  instanceDataToSave);
      savedKeys.push(this.saveKeyAsJson_(
          'instance/' + instanceId,
          instanceDataToSave));
      return Promise.all(savedKeys);
    }

    /**
     * Save all instances to local storage.
     */
    public saveAllInstances = () : Promise<string[]> => {
      // Promise the saving of each instance.
      var savedInstances: Promise<any>[] = [];
      savedInstances = Object.keys(this.state.instances).map(this.saveInstance);
      // Note that despite the fact that the instanceIds are written when we write
      // each instance, we need to write them again anyway, incase they got removed,
      // in which case we need to write the empty list.
      savedInstances.push(this.saveKeyAsJson_(
          C.StateEntries.INSTANCEIDS,
          Object.keys(this.state[C.StateEntries.INSTANCES])));
      return Promise.all(savedInstances);
    }


    // --------------------------------------------------------------------------
    //  Whole state
    // --------------------------------------------------------------------------

    /**
     * Load all aspects of the state concurrently. Note: we make the callback only
     * once the last of the loading operations has completed. We do this using the
     * FinalCaller class.
     */
    public loadStateFromStorage = () : Promise<any> => {
      this.state = restrictKeys(C.DEFAULT_LOAD_STATE, this.state);
      var loadedState: Promise<any>[] = [];
      loadedState.push(this.loadMeFromStorage());
      loadedState.push(this.loadOptionsFromStorage());
      loadedState.push(this.loadAllInstances());
      return Promise.all(loadedState);
    }

    public saveStateToStorage = () : Promise<any> => {
      var savedState: Promise<any>[] = [];
      savedState.push(this.saveMeToStorage());
      savedState.push(this.saveOptionsToStorage());
      savedState.push(this.saveAllInstances());
      return Promise.all(savedState);
    }

  }  // class State

}  // module Core
