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
  var finalCallbacker = new FinalCallback(callback);
  var i, key;

  // Set the saves |me| state and |options|.  Note that in both of
  // these callbacks |key| will be a different value by the time they
  // run.
  key = StateEntries.ME;
  var maybeCallbackAfterLoadingMe = finalCallbacker.makeCountedCallback();
  _loadFromStorage(key, function(v) {
    if (v === null) {
      state.me = _generateMyInstance();
      _saveToStorage("me", state.me);
      log.debug("****** Saving new self-definition *****");
      log.debug("  state.me = " + JSON.stringify(state.me));
    } else {
      log.debug("++++++ Loaded self-definition ++++++");
      log.debug("  state.me = " + JSON.stringify(v));
      state.me = v;
      // Put back any fields that weren't saved (say, from a version change).
      for (var k in RESET_STATE.me) {
        if (state.me[k] === undefined) {
          log.debug(" -- adding back property " + k);
          state.me[k] = cloneDeep(RESET_STATE.me[k]);
        }
      }
      log.debug("  state.me, post repair = " + JSON.stringify(state.me));
      state.me.identities = {};
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
        console.error("Load error: instance " + instanceId + " not found");
      }
      // // see: scraps/validtate-instance.js, but use unit tests instead of
      // // runtime code for type-checking.
      // else if (!_validateStoredInstance(instanceId, instance)) {
      // console.error("instance " + instanceId + " was bad:", instance);
      // TODO: remove bad instance ids?
      //}
      else {
        console.log("instance " + instanceId + " loaded");
        instance.status = DEFAULT_PROXY_STATUS;
        instances[instanceId] = instance;
        // Extrapolate the user & add to the roster.
        var user = state.roster[instance.rosterInfo.userId] = {};
        user.userId = instance.rosterInfo.userId;
        user.name = instance.rosterInfo.name;
        user.network = instance.rosterInfo.network,
        user.url = instance.rosterInfo.url;
        user.clients = {};
        user.hasNotification = Boolean(instance.notify);
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
    //    instanceInfo.description),
    instanceId: instanceId,
    keyHash: instanceInfo.keyHash,
    trust: instanceInfo.trust,
    // Overlay protocol used to get descriptions.
    description: instanceInfo.description,
    notify: Boolean(instanceInfo.notify),
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

// Remember whether uproxy is currently logged on to |network|.
function _saveNetworkState(network, state) {
  log.debug('Saving network state for: ' + network + ' : ' + state);
  _saveToStorage('online/' + network, state);
}

// Load the status for |network|, and reconnect to it if |reconnect| is true.
function _loadNetworkState(network, reconnect) {
  log.debug('Loading network state for: ' + network);
  _loadFromStorage('online/' + network, function (wasOnline) {
    if (reconnect && wasOnline) {
      log.debug('Was previously logged on to ' + network + '. Reconnecting...');
      _Login(network);
    }
  }, false);
}

function checkPastNetworkConnection(network) {
  _loadNetworkState(network, true);
}

// --------------------------------------------------------------------------
