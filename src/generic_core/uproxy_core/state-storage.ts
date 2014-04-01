/**
 * State storage.
 * To see the format used by localstorage, see the file:
 *   scraps/local_storage_example.js
 */
/// <reference path='../../../node_modules/freedom-typescript-api/interfaces/freedom.d.ts' />
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
  class State {

    public state: any;

    constructor() {
      this.state = cloneDeep(C.DEFAULT_LOAD_STATE);
    }

    /**
     * Resets state, and clears local storage.
     * TODO: convert to promise.
     */
    public reset = (callback) => {
      fStorage.clear().done(() => {
        console.log('Cleared storage, now loading again...');
        this.state = cloneDeep(C.DEFAULT_LOAD_STATE);
        this.loadStateFromStorage(callback);
      });
    }

    // --------------------------------------------------------------------------
    // Wrappers for Freedom storage API to work with json instead of strings.

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

    // Callback may be null.
    private saveKeyAsJson_ = (key, val, callback?) => {
      fStorage.set(key, JSON.stringify(val)).done(callback);
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
     * TODO: Convert to promise.
     */
    public saveMeToStorage = (callback) => {
      this.saveKeyAsJson_(
          C.StateEntries.ME,
          restrictKeys(C.DEFAULT_SAVE_STATE.me, this.state.me),
          callback);
    }

    /**
     * Load 'me' from storage, or generate a new instance.
     * TODO: Convert to promise.
     */
    public loadMeFromStorage = (callback) => {
      this.loadKeyAsJson_(C.StateEntries.ME, null).then((me) => {
        if (null === me) {
          this.state.me = this.generateMyInstance_();
          this.saveMeToStorage(callback);
          console.log('****** Saving new self-definition *****');
          console.log('  state.me = ' + JSON.stringify(this.state.me));
        } else {
          console.log('++++++ Loaded self-definition ++++++');
          console.log('  state.me = ' + JSON.stringify(me));
          this.state.me = restrictKeys(this.state.me, me);
          if(callback) { callback(); }
        }
      });
    }

    // --------------------------------------------------------------------------
    //  Options
    // --------------------------------------------------------------------------
    public saveOptionsToStorage = (callback) => {
      this.saveKeyAsJson_(
          C.StateEntries.OPTIONS,
          restrictKeys(C.DEFAULT_SAVE_STATE.options, this.state.options),
          callback);
    }

    // TODO: convert to promise.
    public loadOptionsFromStorage = (callback) => {
      this.loadKeyAsJson_(C.StateEntries.OPTIONS, {}).then((loadedOptions) => {
        this.state.options =
            restrictKeys(cloneDeep(C.DEFAULT_LOAD_STATE.options), loadedOptions);
        if (callback) {
          callback();
        }
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
     * Note: users of this assume that the callback *will* be calld if specified.
     * TODO: convert to promise.
     */
    public loadInstanceFromId = (instanceId:string, callback) => {
      this.loadKeyAsJson_<Instance>('instance/' + instanceId, null)
          .then((instance:Instance) => {
        if (!instance) {
          console.error('Load error: instance ' + instanceId + ' not found');
        } else {
          console.log('instance ' + instanceId + ' loaded');
          instance.status = cloneDeep(C.DEFAULT_PROXY_STATUS);
          this.state.instances[instanceId] = instance;
          this.syncRosterFromInstanceId(instanceId);
        }
        if(callback) { callback(); }
      });
    }

    /**
     * Load all instances from storage. Takes in a FinalCallbacker to make sure
     * that the desired callback is called when the last instance is loaded.
     * TODO: convert to promise.
     */
    public loadAllInstances = (callback) => {
      var finalCallbacker = new FinalCallback(callback);
      // Set the state |instances| from the local storage entries.
      // Load each instance in instance IDs.
      this.loadKeyAsJson_<string[]>(C.StateEntries.INSTANCEIDS, [])
          .then((instanceIds:string[]) => {
        console.log('Loading Instance IDs: ', instanceIds);
        for (var i = 0; i < instanceIds.length; i++) {
          this.loadInstanceFromId(instanceIds[i],
              finalCallbacker.makeCountedCallback());
        }
      });

      // There has to be at least one callback.
      var atLeastOneCountedCallback = finalCallbacker.makeCountedCallback();
      if (atLeastOneCountedCallback) atLeastOneCountedCallback();
    }

    /**
     * Save the instance to local storage. Assumes that both the Instance
     * notification and XMPP user and client information exist and are up-to-date.
     * |instanceId| - string instance identifier (a 40-char hex string)
     * TODO: convert to promise.
     */
    public saveInstance = (instanceId:string, callback) => {
      var finalCallbacker = new FinalCallback(callback);
      // TODO: optimise to only save when different to what was in storage;
      this.saveKeyAsJson_(C.StateEntries.INSTANCEIDS,
          Object.keys(this.state[C.StateEntries.INSTANCES]),
          finalCallbacker.makeCountedCallback());

      if (!(instanceId in this.state.instances)) {
        console.warn('Attempted to save nonexisting instance: ' + instanceId);
        return;
      }
      var instance = this.state.instances[instanceId];
      // Be obscenely strict here, to make sure we don't propagate buggy
      // state across runs (or versions) of UProxy.
      // TODO: make this a type.
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
      this.saveKeyAsJson_('instance/' + instanceId, instanceDataToSave,
          finalCallbacker.makeCountedCallback());
    }

    /**
     * Save all instances to local storage.
     * TODO: convert to promise.
     */
    public saveAllInstances = (callback) => {
      var finalCallbacker = new FinalCallback(callback);
      for(var instanceId in this.state.instances) {
        this.saveInstance(instanceId,
            finalCallbacker.makeCountedCallback());
      }
      // Note that despite the fact that the instanceIds are written when we write
      // each instance, we need to write them again anyway, incase they got removed,
      // in which case we need to write the empty list.
      this.saveKeyAsJson_(C.StateEntries.INSTANCEIDS,
          Object.keys(this.state[C.StateEntries.INSTANCES]),
          finalCallbacker.makeCountedCallback());
    }


    // --------------------------------------------------------------------------
    //  Whole state
    // --------------------------------------------------------------------------

    /**
     * Load all aspects of the state concurrently. Note: we make the callback only
     * once the last of the loading operations has completed. We do this using the
     * FinalCaller class.
     * TODO: convert to promise.
     */
    public loadStateFromStorage = (callback?) => {
      this.state = restrictKeys(C.DEFAULT_LOAD_STATE, this.state);
      var finalCallbacker = new FinalCallback(callback);
      this.loadMeFromStorage(finalCallbacker.makeCountedCallback());
      this.loadOptionsFromStorage(finalCallbacker.makeCountedCallback());
      this.loadAllInstances(finalCallbacker.makeCountedCallback());
    }

    public saveStateToStorage = (callback?) => {
      var finalCallbacker = new FinalCallback(callback);
      this.saveMeToStorage(finalCallbacker.makeCountedCallback());
      this.saveOptionsToStorage(finalCallbacker.makeCountedCallback());
      this.saveAllInstances(finalCallbacker.makeCountedCallback());
    }

  }  // class State

}  // module Core
