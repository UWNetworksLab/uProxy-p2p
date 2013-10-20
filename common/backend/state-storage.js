/**
 * State storage.
 * To see the format used by localstorage, see the file:
 *   scraps/local_storage_example.js
 */
// Stuff for jshint.
// -- uproxy.js
/* global freedom: false */
/* global console: false */
/* global log: false */
// -- nouns-and-adjectives.js
/* global nouns: false */
/* global adjectives: false */
// -- copnstants.js
/* global DEBUG: false */
/* global DEFAULT_LOAD_STATE: false */
/* global DEFAULT_SAVE_STATE: false */
/* global DEFAULT_INSTANCE: false */
/* global DEFAULT_PROXY_STATUS: false */
/* global StateEntries: false */
// -- util.js
/* global isDefined: false */
/* global FinalCallback: false */
/* global cloneDeep: false */
/* global restrictKeys: false */
"use strict";

// --------------------------------------------------------------------------
function UProxyState() {
  this.storage = freedom.storage();
  this.state = cloneDeep(DEFAULT_LOAD_STATE);
}

UProxyState.prototype.reset = function(callback) {
  this.storage.clear().done(function() {
    console.log("Cleared storage, now loading again...");
    this.loadStateFromStorage(callback);
  }.bind(this));
};

// --------------------------------------------------------------------------
// Wrapper functions for Freedom storage API to work with json instead of
// strings.
//
// TODO: Consider using a storage provider that works with JSON.
//
// Note: callback may be null.
UProxyState.prototype._loadKeyAsJson =
    function (key, callback, defaultIfUndefined) {
  this.storage.get(key).done(function (result) {
    console.log("Loaded from storage[" + key + "] (type: " + (typeof result) + "): " +
        result);
    if (isDefined(result)) {
      callback(JSON.parse(result));
    } else {
      callback(defaultIfUndefined);
    }
  });
};

// Callback may be null.
UProxyState.prototype._saveKeyAsJson = function (key, val, callback) {
  this.storage.set(key, JSON.stringify(val)).done(callback);
};

// --------------------------------------------------------------------------
// If one is running UProxy for the first time, or without any available
// instance data, generate an instance for oneself.
UProxyState.prototype._generateMyInstance = function () {
  var i, val, hex, id, key;

  var me = cloneDeep(DEFAULT_LOAD_STATE.me);

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
        me.description = me.description + " " + id;
      } else {
        me.description = id;
      }
    }
  }

  return me;
};

// A simple predicate function to see if we can talk to this client.
UProxyState.prototype.isMessageableUproxyClient = function(client) {
  // TODO(uzimizu): Make identification of whether or not this is a uproxy
  // client more sensible.
  // var retval = (client.status == 'online' ||
                // client.status == 'messageable') &&
                // (client.clientId.indexOf('/uproxy') > 0);
  return 'messageable' == client.status;
};

// --------------------------------------------------------------------------
//  Users's profile for this instance
// --------------------------------------------------------------------------
// Saving your "me" state involves saving all fields that are state.me & that
// are in the DEFAULT_SAVE_STATE.
UProxyState.prototype.saveMeToStorage = function (callback) {
  this._saveKeyAsJson(
      StateEntries.ME,
      restrictKeys(DEFAULT_SAVE_STATE.me, this.state.me),
      callback);
};

UProxyState.prototype.loadMeFromStorage = function (callback) {
  this._loadKeyAsJson(StateEntries.ME, function(me) {
    if (null === me) {
      this.state.me = this._generateMyInstance();
      this.saveMeToStorage(callback);
      console.log("****** Saving new self-definition *****");
      console.log("  state.me = " + JSON.stringify(this.state.me));
    } else {
      console.log("++++++ Loaded self-definition ++++++");
      console.log("  state.me = " + JSON.stringify(me));
      this.state.me = restrictKeys(this.state.me, me);
      if(callback) { callback(); }
    }
  }.bind(this), null);
};

// --------------------------------------------------------------------------
//  Options
// --------------------------------------------------------------------------
UProxyState.prototype.saveOptionsToStorage = function(callback) {
  this._saveKeyAsJson(
      StateEntries.OPTIONS,
      restrictKeys(DEFAULT_SAVE_STATE.options, this.state.options),
      callback);
};

UProxyState.prototype.loadOptionsFromStorage = function(callback) {
  this._loadKeyAsJson(StateEntries.OPTIONS, function (loadedOptions) {
    this.state.options =
        restrictKeys(cloneDeep(DEFAULT_LOAD_STATE.options), loadedOptions);
    if (callback) { callback(); }
  }.bind(this), {});
};

// --------------------------------------------------------------------------
//  Syncronizing Instances
// --------------------------------------------------------------------------
// Give back the instance from a user ID (currently by searching through all
// user ids)
// TODO: consider creating a userId <-> instanceId multi-mapping.
UProxyState.prototype.instanceOfUserId = function(userId) {
  // console.log('INSTANCE TABLE!!: ' + JSON.stringify(this.state.instances));
  for (var i in this.state.instances) {
    // console.log('INSTANCE: ' + JSON.stringify(this.state.instances[i]));
    if (this.state.instances[i].rosterInfo.userId == userId)
      return this.state.instances[i];
  }
  return null;
};

// Should be called whenever an instance is created/loaded.
// Assumes that the instance corresponding to instanceId has a userId. Although
// the user doens't need to currently be in the roster - this function will add
// to the roster if the userId is not already present.
UProxyState.prototype.syncRosterFromInstanceId = function(instanceId) {
  var instance = this.state.instances[instanceId];
  var userId = instance.rosterInfo.userId;
  var user = this.state.roster[userId];

  // Extrapolate the user & add to the roster.
  if (!user) {
    // TODO: do proper reconsilisation: probably we should do a diff check, and
    // maybe update instance.nodify.
    this.state.roster[userId] = {};
    user = this.state.roster[userId];
    user.clients = {};
    user.userId = userId;
    user.name = instance.rosterInfo.name;
    user.network = instance.rosterInfo.network;
    user.url = instance.rosterInfo.url;
    user.hasNotification = Boolean(instance.notify);
  }
};

// Called when a new userId is available. & when a new instance
// happens. We check to see if we need to update our instance information.
// Assumes that an instacne already exists for this userId.
UProxyState.prototype.syncInstanceFromInstanceMessage =
    function(userId, clientId, data) {
  var instanceId = data.instanceId;
  // Some local metadata isn't transmitted.  Add it in.
  data = restrictKeys(DEFAULT_INSTANCE, data);

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
    instance = cloneDeep(DEFAULT_INSTANCE);
    instance.instanceId = data.instanceId;
    instance.keyHash = data.keyHash;
    this.state.instances[instanceId] = instance;
  }
  instance.rosterInfo = data.rosterInfo;
  instance.rosterInfo.userId = userId;
  instance.description = data.description;

  this.syncRosterFromInstanceId(instanceId);
};

// --------------------------------------------------------------------------
//  Loading & Saving Instances
// --------------------------------------------------------------------------
// Note: users of this assume that the callback *will* be calld if specified.
UProxyState.prototype.loadInstanceFromId = function(instanceId, callback) {
  this._loadKeyAsJson("instance/" + instanceId, function(instance) {
    if (! instance) {
      console.error("Load error: instance " + instanceId + " not found");
    } else {
      console.log("instance " + instanceId + " loaded");
      instance.status = cloneDeep(DEFAULT_PROXY_STATUS);
      this.state.instances[instanceId] = instance;
      this.syncRosterFromInstanceId(instanceId);
    }
    if(callback) { callback(); }
  }.bind(this), null);
};

// Loads all instances from storage. Takes in a FinalCallbacker to make sure
// that the desired callback is called when the last instance is loaded.
UProxyState.prototype.loadAllInstances = function(callback) {
  var finalCallbacker = new FinalCallback(callback);
  // Set the state |instances| from the local storage entries.
  // Load each instance in instance IDs.
  this._loadKeyAsJson(StateEntries.INSTANCEIDS, function(instanceIds) {
    for (var i = 0; i < instanceIds.length; i++) {
      this.loadInstanceFromId(instanceIds[i],
          finalCallbacker.makeCountedCallback());
    }
  }.bind(this), []);

  // There has to be at least one callback.
  var atLeastOneCountedCallback = finalCallbacker.makeCountedCallback();
  if (atLeastOneCountedCallback) atLeastOneCountedCallback();
};

// Save the instance to local storage. Assumes that both the Instance
// notification and XMPP user and client information exist and are up-to-date.
// |instanceId| - string instance identifier (a 40-char hex string)
UProxyState.prototype.saveInstance = function(instanceId, callback) {
  var finalCallbacker = new FinalCallback(callback);
  // TODO: optimise to only save when different to what was in storage;
  this._saveKeyAsJson(StateEntries.INSTANCEIDS,
      Object.keys(this.state[StateEntries.INSTANCES]),
      finalCallbacker.makeCountedCallback());

  var instance = this.state.instances[instanceId];
  // Be obscenely strict here, to make sure we don't propagate buggy
  // state across runs (or versions) of UProxy.
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
  console.log('saveInstance: saving "instance/"' + instanceId + '": ' +
      JSON.stringify(instanceDataToSave));
  this._saveKeyAsJson("instance/" + instanceId, instanceDataToSave,
      finalCallbacker.makeCountedCallback());
};

UProxyState.prototype.saveAllInstances = function(callback) {
  var finalCallbacker = new FinalCallback(callback);
  for(var instanceId in this.state.instances) {
    this.saveInstance(instanceId,
        finalCallbacker.makeCountedCallback());
  }
  // Note that despite the fact that the instanceIds are written when we write
  // each instance, we need to write them again anyway, incase they got removed,
  // in which case we need to write the empty list.
  this._saveKeyAsJson(StateEntries.INSTANCEIDS,
      Object.keys(this.state[StateEntries.INSTANCES]),
      finalCallbacker.makeCountedCallback());
};

// --------------------------------------------------------------------------
//  Whole state
// --------------------------------------------------------------------------
// Load all aspects of the state concurrently. Note: we make the callback only
// once the last of the loading operations has completed. We do this using the
// FinalCaller class.
UProxyState.prototype.loadStateFromStorage = function(callback) {
  // this.state = restrictKeys(this.state, DEFAULT_LOAD_STATE);
  this.state = restrictKeys(DEFAULT_LOAD_STATE, this.state);
  // this.state = cloneDeep(DEFAULT_LOAD_STATE);
  // this.state = restrictKeys(DEFAULT_LOAD_STATE, DE);
  var finalCallbacker = new FinalCallback(callback);
  this.loadMeFromStorage(finalCallbacker.makeCountedCallback());
  this.loadOptionsFromStorage(finalCallbacker.makeCountedCallback());
  this.loadAllInstances(finalCallbacker.makeCountedCallback());
};

UProxyState.prototype.saveStateToStorage = function(callback) {
  var finalCallbacker = new FinalCallback(callback);
  this.saveMeToStorage(finalCallbacker.makeCountedCallback());
  this.saveOptionsToStorage(finalCallbacker.makeCountedCallback());
  this.saveAllInstances(finalCallbacker.makeCountedCallback());
};


// --------------------------------------------------------------------------
