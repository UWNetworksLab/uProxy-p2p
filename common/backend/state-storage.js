/**
 * State storage.
 * To see the format used by localstorage, see the file:
 *   scraps/local_storage_example.js
 */
// Stuff for jshint.
/* global freedom: false */
/* global console: false */
/* global isDefined: false */
/* global FinalCallback: false */
/* global nouns: false */
/* global adjectives: false */
/* global log: false */
/* global DEFAULT_PROXY_STATUS: false */
/* global DEBUG: false */
/* global cloneDeep: false */
/* global restrictToObject: false */
/* global state: true */
"use strict";

// --------------------------------------------------------------------------
// Initial empty state
// --------------------------------------------------------------------------
// enum of state ids that we need to worry about.
var StateEntries = {
  ME: 'me',
  OPTIONS: 'options',
  INSTANCEIDS: 'instanceIds', // only exists for local storage state.
  INSTANCES: 'instances',   // only exists for in-memory state.
};

var RESET_STATE = {
  // debugging stuff
  '_debug': DEBUG,  // debug state.
  '_msgLog': [],  //

  // A table from network identifier to your status on that network
  // (online/offline/idle, etc)
  'identityStatus': {},

  // me : {
  //   description : string,  // descirption of this installed instance
  //   instanceId : string,   // id for this installed instance
  //   keyHash : string,      // hash of your public key for peer connections
  //   peerAsProxy : string,  // proxying clientId if connected else null
  //   peersAsClients : [     // clientIds using me as a proxy.
  //     clientId, ... ]
  //   networkDefaults : {    // network connection defaults
  //     [networkNameX]: {    // identifier for the network
  //       autoconnect: boolean  // if true connects at startup
  //     }, ...
  //   },
  //   [userIdX] : {
  //     userId : string,     // same as key [userIdX].
  //     name : string,       // user-friendly name given by network
  //     url : string         // ?
  //     clients: {
  //       [clientIdX]: {
  //         clientId: string, // same as key [clientIdX].
  //         // TODO: users should live in network, not visa-versa!
  //         network: string   // unique id for the network connected to.
  //         status: string
  //       }, ...
  //     }
  //   }, ... // userIdX
  // }
  // Local client's information.
  'me': {
    'description': '',
    'instanceId': '',
    'keyHash': '',
    'identities': {},
    'peerAsProxy': null,
    'peersAsClients': [],
    'networkDefaults' : {}
  },

  // roster: {
  //   [userIdX]: {
  //     userId: string,
  //     name: string,
  //     url: string,
  //     clients: {
  //       [clientIdX]: {
  //         clientId: string, // same as key [clientIdX].
  //         // TODO: users should live in network, not visa-versa!
  //         network: string
  //         status: string
  //       }, ... clientIdX
  //     },
  //   } ... userIdX
  // }
  // Merged contact lists from each identity provider.
  'roster': {},

  // instances: {
  //   [instanceIdX]: {
  //     // From Network/identity:
  //     name: string,
  //     userId: string,
  //     network: string,
  //     url: string,
  //     // Instance specific
  //     description: string,
  //     // annotation: string, // TODO
  //     instanceId: string,
  //     keyhash: string,
  //     trust: {
  //       asProxy: Trust
  //       asClient: Trust
  //     }
  //     status {
  //       activeProxy: boolean
  //       activeClient: boolean
  //     }
  //   }
  // }

  // instanceId -> instance. Active UProxy installations.
  'instances': {},

  // ID mappings.
  // TODO: Make these mappings properly properly reflect that an instance can
  // be connected to multiple networks and therefore have multiple client ids.
  // TODO: add mappings between networks?
  'clientToInstance': {},      // instanceId -> clientId
  'instanceToClient': {},      // clientId -> instanceId

  // Options coming from local storage and setable by the options page.
  // TODO: put real values in here.
  'options': {
    // TODO: connect this option to the actual proxy config code.
    'allowNonRoutableAddresses': false,
    // See: https://gist.github.com/zziuni/3741933
    // http://www.html5rocks.com/en/tutorials/webrtc/basics/
    //   'stun:stun.l.google.com:19302'
    // Public Google Stun server:
    //
    'stunServers': ['stun:stun.l.google.com:19302',
                    'stun.services.mozilla.com'],
    // TODO: These may need to be set dynamically. see:
    // https://code.google.com/p/webrtc/source/browse/trunk/samples/js/apprtc/apprtc.py#430
    // e.g. https://computeengineondemand.appspot.com/turn?username=UNIQUE_IDENTIFIER_FROM_ANYWHERE&key=4080218913
    'turnServers': ['turnServer1', 'turnServer2']
  }
};

// --------------------------------------------------------------------------
function UProxyState() {
  this.storage = freedom.storage();
  this.state = cloneDeep(RESET_STATE);
}

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
    console.log("Loaded from storage[" + key + "] (type: " + (typeof result) + "): " + result);
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

  var me = cloneDeep(RESET_STATE.me);

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
    // using the whole of the .
    if (i < 4) {
      id = (i & 1) ? nouns[val] : adjectives[val];
      if (me.description !== null) {
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
  var retval = (client.status == 'online' ||
                client.status == 'messageable') &&
                (client.clientId.indexOf('/uproxy') > 0);
  return retval;
};

// --------------------------------------------------------------------------
//  Users's profile for this instance
// --------------------------------------------------------------------------
// Saving your "me" state involves saving all fields that are state.me & that
// are in the RESET_STATE. RESET_STATE defines all fields that should be saved
// . If something is dynamic, it is not in RESET_STATE and should not be
// saved.
UProxyState.prototype.saveMeToStorage = function (callback) {
  this._saveKeyAsJson(StateEntries.ME,
                      restrictToObject(RESET_STATE.me, this.state.me),
                      callback);
};

UProxyState.prototype.loadMeFromStorage = function (callback) {
  this._loadKeyAsJson(StateEntries.ME, function(v) {
    if (v === null) {
      this.state.me = this._generateMyInstance();
      this._saveMeToStorage(callback);
      log.debug("****** Saving new self-definition *****");
      log.debug("  state.me = " + JSON.stringify(this.state.me));
    } else {
      log.debug("++++++ Loaded self-definition ++++++");
      log.debug("  state.me = " + JSON.stringify(v));
      this.state.me = v;
      // Put back any fields that weren't saved (say, from a version change).
      for (var k in RESET_STATE.me) {
        if (!(k in this.state.me)) {
          log.debug(" -- adding back property " + k);
          this.state.me[k] = cloneDeep(RESET_STATE.me[k]);
        }
      }
      log.debug("  state.me, post repair = " + JSON.stringify(this.state.me));
      if(callback) { callback(); }
    }
  }.bind(this), null);
};

// --------------------------------------------------------------------------
//  Options
// --------------------------------------------------------------------------
UProxyState.prototype.saveOptionsToStorage = function(callback) {
  this._saveKeyAsJson(StateEntries.ME,
                      restrictToObject(RESET_STATE.options, this.state.options),
                      callback);
};

UProxyState.prototype.loadOptionsFromStorage = function(callback) {
  this._loadKeyAsJson(StateEntries.OPTIONS, function (loadedOptions) {
    this.state.options = loadedOptions;
  }.bind(this), RESET_STATE.options);
};

// --------------------------------------------------------------------------
//  Instances
// --------------------------------------------------------------------------
// Give back the instance from a user ID (currently by searching through all
// user ids)
// TODO: consider creating a userId <-> instanceId multi-mapping.
UProxyState.prototype.instanceOfUserId = function(userId) {
  for (var i in this.state.instances) {
    if (this.state.instances[i].rosterInfo.userId == userId)
      return this.state.instances[i];
  }
  return null;
};

// Called when a new userId is available. CHECK: (or we get a new instance
// message). We check to see if we need to update our instance information.
// Assumes that an instacne already exists for this userId.
UProxyState.prototype.syncInstanceFromUserID = function(userId) {
  var user = this.state.roster[userId];
  var instance = this.instanceOfUserId(userId);
  if (!instance) {
    console.error("No instance for userId: " + userId);
    return;
  }

  // Look for client Id corresponding to this instance.
  var instanceClientId = null;
  for(var clientId in user.clients) {
    if(this.isMessageableUproxyClient(user.clients[clientId])) {
      instanceClientId = clientId;
    }
  }

  if (instanceClientId) {
      this.state.instanceToClient[instance.instanceId] = instanceClientId;
      this.state.clientToInstance[instanceClientId] = instance.instanceId;
  } else {
      delete this.state.instanceToClient[instance.instanceId];
      delete this.state.clientToInstance[instanceClientId];
  }
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
    user = this.state.roster[userId] = {};
    user.clients = {};
    user.userId = userId;
    user.name = instance.rosterInfo.name;
    user.network = instance.rosterInfo.network;
    user.url = instance.rosterInfo.url;
    user.hasNotification = Boolean(instance.notify);
  } else {
    // Make sure the cleint-instance mappings are in sync/up to date.
    this.syncInstanceFromUserID(userId);
  }
};

// Note: users of this assume that the callback *will* be calld if specified.
UProxyState.prototype.loadInstanceFromId = function(instanceId, callback) {
  this._loadKeyAsJson("instance/" + instanceId, function(instance) {
    if (! instance) {
      console.error("Load error: instance " + instanceId + " not found");
    } else {
      console.log("instance " + instanceId + " loaded");
      instance.status = DEFAULT_PROXY_STATUS;
      this.state.instances[instanceId] = instance;
      this.syncRosterFromInstanceId(instanceId);
    }
    if(callback) { callback(); }
  }.bind(this), null);
};

// Loads all instances from storage. Takes in a FinalCallbacker to make sure
// that the desired callback is called when the last instance is loaded.
UProxyState.prototype._loadInstances = function(finalCallbacker) {
  // Set the state |instances| from the local storage entries.
  // Load each instance in instance IDs.
  this._loadKeyAsJson(StateEntries.INSTANCEIDS, function(instanceIds) {
    for (var i = 0; i < instanceIds.length; i++) {
      this.loadInstanceFromId(
          instanceIds[i], finalCallbacker.makeCountedCallback());
    }
  }.bind(this), []);
};

// Save the instance to local storage. Assumes that both the Instance
// notification and XMPP user and client information exist and are up-to-date.
// |instanceId| - string instance identifier (a 40-char hex string)
// |userId| - The userId such as 918a2e3f74b69c2d18f34e6@public.talk.google.com.
UProxyState.prototype.saveInstance = function(instanceId, callback) {
  // TODO: optimise to only save when different to what was in storage before.
  this._saveKeyAsJson(StateEntries.INSTANCEIDS,
      Object.keys(state[StateEntries.INSTANCES]), callback);

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
  log.debug('_saveInstance: saving "instance/"' + instanceId + '": ' +
      JSON.stringify(instanceDataToSave));
  this._saveKeyAsJson("instance/" + instanceId, instanceDataToSave, callback);
};

// --------------------------------------------------------------------------
// Load all aspects of the state concurrently. Note: we make the callback only
// once the last of the loading operations has completed. We do this using the
// FinalCaller class.
UProxyState.prototype.loadStateFromStorage = function(callback) {
  var finalCallbacker = new FinalCallback(callback);
  this.loadMeFromStorage(finalCallbacker.makeCountedCallback());
  this.loadOptionsFromStorage(finalCallbacker.makeCountedCallback());
  this._loadInstances(finalCallbacker);
};

// --------------------------------------------------------------------------
