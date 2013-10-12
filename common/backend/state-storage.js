/**
 * State storage.
 */
// Stuff for jshint.
/* global storage: false */
/* global console: false */
/* global state: false */
/* global isDefined: false */
/* global FinalCallback: false */
/* global StateEntries: false */
/* global nouns: false */
/* global adjectives: false */
/* global log: false */
/* global RESET_STATE: false */
"use strict";

// --------------------------------------------------------------------------
//  Local Storage
// --------------------------------------------------------------------------
// To see the format used by localstorage, see the file:
//   scraps/local_storage_example.js
function _loadFromStorage(key, callback, defaultIfUndefined) {
  storage.get(key).done(function (result) {
    console.log("Loaded from storage[" + key + "] (type: " + (typeof result) + "): " + result);
    if (isDefined(result)) {
      callback(JSON.parse(result));
    } else {
      callback(defaultIfUndefined);
    }
  });
}

function _saveToStorage(key, val, callback) {
  storage.set(key, JSON.stringify(val)).done(callback);
}

function _loadStateFromStorage(state, callback) {
  var i, val, hex, id, key, instanceIds = [];

  var finalCallbacker = new FinalCallback(callback);

  // Set the saves |me| state and |options|.  Note that in both of
  // these callbacks |key| will be a different value by the time they
  // run.
  key = StateEntries.ME;
  var maybeCallbackAfterLoadingMe = finalCallbacker.makeCountedCallback();
  _loadFromStorage(key, function(v) {
    if (v === null) {
      // Create an instanceId if we don't have one yet.
      state.me.instanceId = '';
      state.me.description = null;
      state.me.keyHash = '';
      // Just generate 20 random 8-bit numbers, print them out in hex.
      // TODO: check use of randomness: why not one big random number that is
      // serialised?
      for (i = 0; i < 20; i++) {
        // 20 bytes for the instance ID.  This we can keep.
        val = Math.floor(Math.random() * 256);
        hex = val.toString(16);
        state.me.instanceId = state.me.instanceId +
            ('00'.substr(0, 2 - hex.length) + hex);

        // 20 bytes for a fake key hash. TODO(mollyling): Get a real key hash.
        val = Math.floor(Math.random() * 256);
        hex = val.toString(16);

        state.me.keyHash = ((i > 0)? (state.me.keyHash + ':') : '')  +
            ('00'.substr(0, 2 - hex.length) + hex);

        // TODO: separate this out and use full space of possible names by
        // using the whole of the .
        if (i < 4) {
          id = (i & 1) ? nouns[val] : adjectives[val];
          if (state.me.description !== null) {
            state.me.description = state.me.description + " " + id;
          } else {
            state.me.description = id;
          }
        }
      }
      _saveToStorage("me", state.me);
      log.debug("****** Saving new self-definition *****");
      log.debug("  state.me = " + JSON.stringify(state.me));
    } else {
      log.debug("++++++ Loaded self-definition ++++++");
      log.debug("  state.me = " + JSON.stringify(v));
      state.me = v;
    }
    maybeCallbackAfterLoadingMe();
  }, null);

  key = StateEntries.OPTIONS;
  var maybeCallbackAfterLoadingOptions = finalCallbacker.makeCountedCallback();
  _loadFromStorage(key, function(options) {
    state[StateEntries.OPTIONS] = options;
    maybeCallbackAfterLoadingOptions();
  }, RESET_STATE[key]);

  // Set the state |instances| from the local storage entries.
  var instances = {};
  state[StateEntries.INSTANCES] = instances;
  key = StateEntries.INSTANCEIDS;

  var checkAndSave = function(instanceId) {
    var maybeCallbackAfterLoadingInstance =
        finalCallbacker.makeCountedCallback();
    _loadFromStorage("instance/" + instanceId, function(instance) {
      if (null === instance) {
        console.error("instance " + instanceId + " not found");
      }
      // // see: scraps/validtate-instance.js, but use unit tests instead of
      // // runtime code for type-checking.
      // else if (!_validateStoredInstance(instanceId, instance)) {
      // console.error("instance " + instanceId + " was bad:", instance);
      // TODO: remove bad instance ids?
      //}
      else {
        console.log("instance " + instanceId + " loaded");
        instances[instanceId] = instance;
        // Add to the roster.
        var user = state.roster[instance.rosterInfo.userId] = {};
        user.userId = instance.rosterInfo.userId;
        user.name = instance.rosterInfo.name;
        user.network = instance.rosterInfo.network;
        user.url = instance.rosterInfo.url;
        user.clients = {};
      }
      maybeCallbackAfterLoadingInstance();
    }, null);
  };

  // Load
  _loadFromStorage(StateEntries.INSTANCEIDS, function(instanceIds) {
    console.log("instanceIds typeof = " + (typeof instanceIds));
    console.log('instanceIds: ' + instanceIds);
    for (i = 0; i < instanceIds.length; i++) {
      checkAndSave(instanceIds[i]);
    }
  }, []);

  log.debug('_loadStateFromStorage: loaded: ' + JSON.stringify(state));
}

// Save the instance to local storage. Assumes that both the Instance
// notification and XMPP user and client information exist and are up-to-date.
// |instanceId| - string instance identifier (a 40-char hex string)
// |userId| - The userId such as 918a2e3f74b69c2d18f34e6@public.talk.google.com.
function _saveInstance(instanceId) {
  // Be obscenely strict here, to make sure we don't propagate buggy
  // state across runs (or versions) of UProxy.
  var instanceInfo = state.instances[instanceId];
  var instance = {
    // Instance stuff:
    // annotation: getKeyWithDefault(instanceInfo, 'annotation',
    //    instanceInfo.description),  // TODO
    instanceId: instanceId,
    keyHash: instanceInfo.keyHash,
    trust: instanceInfo.trust,
    // Overlay protocol used to get descriptions.
    description: instanceInfo.description,
    // Network stuff
    rosterInfo: instanceInfo.rosterInfo
  };
  log.debug('_saveInstance: saving "instance/"' + instanceId + '": ' +
      JSON.stringify(instance));
  _saveToStorage("instance/" + instanceId, instance);
}

function _saveAllInstances() {
  // Go through |roster.client[*].clients[*]|, and save every instance
  // with an instanceId.  We pull data from both the|state.instances|
  // and |state.roster| objects.
  for (var userId in state.roster) {
    for (var clientId in state.roster[userId]) {
      var rosterClient = state.roster[userId].clients[clientId];
      if (rosterClient.instanceId !== undefined && rosterClient.instanceId) {
        _saveInstance(rosterClient.instanceId);
      }
    }
  }
  // Now save the entire instanceIds list.
  _saveToStorage(StateEntries.INSTANCEIDS,
      Object.keys(state[StateEntries.INSTANCES]));
}
