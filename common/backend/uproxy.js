/**
 * uproxy.js
 *
 * This is the primary backend script. It maintains both in-memory state and
 * checkpoints information to local storage.

 * In-memory state includes:
 *  - Roster, which is a list of contacts, always synced with XMPP friend lists.
 *  - Instances, which is a list of active UProxy installs.
 */
'use strict';

// Called once when uproxy.js is loaded.
// TODO: WebWorkers startup errors are hard to debug.
// Once fixed, the setTimeout will no longer be needed.

/*global self, makeLogger, freedom, cloneDeep, isDefined, nouns, adjectives */   // for jslint.
var DEBUG = true; // XXX get this from somewhere else
console.log('Uproxy backend, running in worker ' + self.location.href);

var window = {};  //XXX: Makes chrome debugging saner, not needed otherwise.

var log = {
  debug: DEBUG ? makeLogger('debug') : function(){},
  error: makeLogger('error')
};

// Channels with module interface to speak to the various providers.

// Identity is a module that speaks to chat networks and does some message
// passing to manage contacts privilages and initiate proxying.
var identity = freedom.identity();

// Storage is used for saving settings to the browsre local storage available
// to the extension.
var storage = freedom.storage();

// Client is used to manage a peer connection to a contact that will proxy our
// connection. This module listens on a localhost port and forwards requests
// through the peer connection.
var client = freedom.uproxyclient();

// Server module; listens for peer connections and proxies their requests
// through the peer connection.
var server = freedom.uproxyserver();
server.emit("start");

// The channel to speak to the UI part of uproxy. The UI is running from the
// privileged part of freedom, so we can just set this to be freedom.
var uiChannel = freedom;

// enum of state ids that we need to worry about.
var StateEntries = {
  ME: 'me',
  OPTIONS: 'options',
  INSTANCEIDS: 'instanceIds', // only exists for local storage state.
  INSTANCES: 'instances',   // only exists for in-memory state.
};

var Trust = {
  NO: 'no',
  REQUESTED: 'requested',
  OFFERED: 'offered',
  YES: 'yes'
};

var ProxyState = {
  OFF: 'off',
  READY: 'ready',
  RUNNING: 'running'
}

var VALID_NETWORKS = {
  GOOGLE: 'google',
  FACEBOOK: 'facebook',
};

//var TrustType = {
//  PROXY: 'asProxy',
//  CLIENT: 'asClient'
//};

// Keys that we don't save to local storage each time.
// Format: each key is a dot-delimited path.
//
// TODO(mollying): allow * to denote any-value for a single element of
// a path.
//
// TODO(mollying): doesn't seem to be used, remove?
var TRANSIENT_STATE_KEYS = [];

// Initial empty state
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
  //       }, ... clientIdX
  //     }
  //   }, ... userIdX
  // }
  // Local client's information.
  'me': {
    'description': '',
    'instanceId': '',
    'keyHash': '',
    'identities': {},
    'peerAsProxy': null,
    'peersAsClients': []
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
    'allowNonRoutableAddresses': false,
    // See: https://gist.github.com/zziuni/3741933
    // http://www.html5rocks.com/en/tutorials/webrtc/basics/
    //   'stun:stun.l.google.com:19302'
    'stunServers': ['stunServer1', 'stunServer2'],
    'turnServers': ['turnServer1', 'turnServer2']
  }
};
var state = cloneDeep(RESET_STATE);

var DEFAULT_PROXY_STATUS = {
    proxy: ProxyState.OFF,
    client: ProxyState.OFF
};

// Instance object.
var DEFAULT_INSTANCE = {
  instanceId: null,  // Primary key.
  keyHash: null,
  trust: {
    asProxy: Trust.NO,
    asClient: Trust.NO
  },
  status: DEFAULT_PROXY_STATUS,
  description: '',
  rosterInfo: {  // Ifo corresponding to its roster entry
    userId: '',
    name: '',
    network: '',
    url: ''
  }
};

// If one is running UProxy for the first time, or without any available
// instance data, generate an instance for oneself.
function _generateMyInstance() {
  var me = {};
  me.instanceId = '';
  me.description = null;
  me.keyHash = '';
  // Create an instanceId if we don't have one yet.
  // Just generate 20 random 8-bit numbers, print them out in hex.
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
}

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
      state.me = _generateMyInstance();
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
    rosterInfo: instanceInfo.rosterInfo  // Network stuff:
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
//  General UI interaction
// --------------------------------------------------------------------------

function sendFullStateToUI() {
  console.log("sending sendFullStateToUI state-change.");
  uiChannel.emit('state-change', [{op: 'replace', path: '', value: state}]);
  //
  // Note: this is not the same as replace: replace only works if the path is
  // already there.
/*   for(var k in state) {
    uiChannel.emit('state-change', [{op: 'replace', path: '/' + k, value: state[k]}]);
     uiChannel.emit('state-change', [{op: 'remove', path: '/' + k}]);
    uiChannel.emit('state-change', [{op: 'add', path: '/' + k, value: state[k]}]);

  } */
};

// Define freedom bindings.
uiChannel.on('reset', function () { reset(); });

// Logs out of networks and resets data.
function reset() {
  log.debug('reset');
  identity.logout(null, null);
  state = cloneDeep(RESET_STATE);
  storage.clear().done(function() {
    console.log("Cleared storage.");
    _loadStateFromStorage(state, function () {
      console.log("Emiting a state-change");
      sendFullStateToUI();
    });
  });
}

// Called from extension whenever the user clicks opens the extension popup.
// The intent is to reset its model - but this may or may not always be
// necessary. Improvements to come.
uiChannel.on('open-popup', function () {
  log.debug('open-popup');
  log.debug('state:', state);
  // Send the extension the full state.
  sendFullStateToUI();
});

// Update local user's online status (away, busy, etc.).
identity.on('onStatus', function(data) {
  log.debug('onStatus: data:' + JSON.stringify(data));
  if (data.userId) {
    state.identityStatus[data.network] = data;
    uiChannel.emit('state-change',
        [{op: 'add', path: '/identityStatus/' + data.network, value: data}]);
    if (!state.me.identities[data.userId]) {
      state.me.identities[data.userId] = {userId: data.userId};
    }
  }
});

// Called when a contact (or ourselves) changes state, whether online or
// description.
identity.on('onChange', function(data) {
  // log.debug('onChange: data:' + JSON.stringify(data));
  if (!data.userId) {
    log.error('onChange: missing userId! ' + JSON.stringify(data));
  }
  if (state.me.identities[data.userId]) {
    // My card changed.
    state.me.identities[data.userId] = data;
    _SyncUI('/me/clients/' + data.userId, data, 'add');
    // TODO: Handle changes that might affect proxying
  } else {
    updateUser(data);  // Not myself.
  }
});

identity.on('onMessage', function (msgInfo) {
  log.debug("identity.on('onMessage'): msgInfo: ", msgInfo);
  // state._msgLog.push(msgInfo);
  // uiChannel.emit('state-change',
      // [{op: 'add', path: '/_msgLog/-', value: msgInfo}]);
  var jsonMessage = {};
  msgInfo.messageText = msgInfo.message;
  delete msgInfo.message;
  try {
    // Replace the JSON str with actual data attributes, then flatten.
    msgInfo.data = JSON.parse(msgInfo.messageText);
  } catch(e) {
    msgInfo.unparseable = true;
  }
  // By passing
  _handleMessage(msgInfo, false);  // beingSent = false
});

uiChannel.on('login', function(network) {
  _Login(network);
});

uiChannel.on('logout', function(network) {
  identity.logout(null, network);
  state.clientToInstance = {};  // Clear the clientsToInstance table.
  _saveNetworkState(network, false);
});

uiChannel.on('ignore', function (userId) {
  // TODO: fix.
});

uiChannel.on('invite-friend', function (userId) {
  identity.sendMessage(userId, "Join UProxy!");
});

uiChannel.on('echo', function (msg) {
  // state._msgLog.push(msg);
  // uiChannel.emit('state-change', [{op: 'add', path: '/_msgLog/-', value: msg}]);
});

uiChannel.on('change-option', function (data) {
  state.options[data.key] = data.value;
  _saveToStorage('options', state.options);
  log.debug('saved options ' + JSON.stringify(state.options));
  uiChannel.emit('state-change', [{op: 'replace', path: '/options/'+data.key, value: data.value}]);
  // TODO: Handle changes that might affect proxying
});

// Updating our own UProxy instance's description.
uiChannel.on('update-description', function (data) {
  state.me.description = data;  // UI side already up-to-date.
  _fetchMyInstance(true);       // Reset local instance data.

  // TODO(uzimizu): save to storage
  var payload = JSON.stringify({
    type: 'update-description',
    instanceId: '' + state.me.instanceId,
    description: '' + state.me.description
  });

  // Send the new description to ALL currently online friend instances.
  for (var instanceId in state.instances) {
    var clientId = state.instanceToClient[instanceId];
    if (!clientId)  // || 'offline' == state.roster[state.instances[instanceId]].clients[clientId].status)
      continue;
    identity.sendMessage(clientId, payload);
  }
});

// --------------------------------------------------------------------------
//  Data management
// --------------------------------------------------------------------------

function instanceOfUserId(userId) {
  for (var i in state.instances) {
    if (state.instances[i].userId == userId) return state.instances[i];
  }
  return null;
};

// --------------------------------------------------------------------------
//  Proxying
// --------------------------------------------------------------------------
// TODO: say not if we havn't given them permission :)
uiChannel.on('start-using-peer-as-proxy-server', function(peerInstanceId) {
  startUsingPeerAsProxyServer(state.instanceToClient[peerInstanceId]);
});

uiChannel.on('stop-proxying', function(peerInstanceId) {
  stopUsingPeerAsProxyServer(peerInstanceId);
});

client.on('sendSignalToPeer', function(data) {
    console.log('client(sendSignalToPeer):' + JSON.stringify(data) +
                ', sending to ' + data.peerId);
  // TODO: don't use 'message' as a field in a message! that's confusing!
  identity.sendMessage(
      data.peerId,
      JSON.stringify({type: 'peerconnection-client', data: data.data}));
});

server.on('sendSignalToPeer', function(data) {
  console.log('server(sendSignalToPeer):' + JSON.stringify(data) +
                ', sending to ' + data.peerId);
  identity.sendMessage(data.peerId, JSON.stringify(
      {type: 'peerconnection-server', data: data.msg}));
});

function startUsingPeerAsProxyServer(peerInstanceId) {
  var instance = state.instances[peerInstanceId];
  if (!instance) {
    log.error('Instance ' + peerInstanceId + ' does not exist! Cannot proxy...')
    return false;
  }
  if ('yes' != state.instances[peerInstanceId].trust.asProxy) {
    log.debug('Lacking permission to proxy through ' + peerInstanceId);
    return false;
  }
  // TODO: Cleanly disable any previous proxying session.
  state.me.peerAsProxy = peerInstanceId;
  _SyncUI('/me/peerAsProxy', peerInstanceId);
  instance.status.proxy = ProxyState.RUNNING;
  // _SyncUI('/instances/' + peerInstanceId, instance);
  _SyncInstance(instance, 'status');

  // TODO: sync properly between the extension and the app on proxy settings
  // rather than this cooincidentally the same data.
  // client.emit("start",
    // {'host': '127.0.0.1', 'port': 9999,
      // peerId of the peer being routed to.
     // 'peerId': peerClientId});
  // TODO: set that we are negotiating.
}

function stopUsingPeerAsProxyServer(peerInstanceId) {
  var instance = state.instances[peerInstanceId];
  if (!instance) {
    log.error('Instance ' + peerInstanceId + ' does not exist!')
    return false;
  }
  // TODO: Handle revoked permissions notifications.

  // TODO: check permission first.
  state.me.peerAsProxy = null;
  _SyncUI('/me/peerAsProxy', '');
  // uiChannel.emit('state-change',
      // [{op: 'replace', path: '/me/peerAsProxy', value: ''}]);
  client.emit("stop");
  instance.status.proxy = ProxyState.OFF;
  _SyncInstance(instance, 'status');
}

// peerconnection-client
function handleClientSignalToPeer(msg) {
    console.log('handleClientSignalToPeer: ' + JSON.stringify(msg));
    server.emit('handleSignalFromPeer', msg);
}

// peerconnection-server
function handleServerSignalToPeer(msg) {
    console.log('handleServerSignalToPeer: ' + JSON.stringify(msg));
    client.emit('handleServerSignalToPeer', msg);
}

// --------------------------------------------------------------------------
//  Trust
// --------------------------------------------------------------------------
// action -> target trust level.
var TrustOp = {
  // If Alice |action|'s Bob, then Bob acts as the client.
  'allow': Trust.YES,
  'offer': Trust.OFFERED,
  'deny': Trust.NO,
  // Bob acts as the proxy.
  'request-access': Trust.REQUESTED,
  'cancel-request': Trust.NO,
  'accept-offer': Trust.YES,
  'decline-offer': Trust.NO
};

// Update trust level for an instance.
uiChannel.on('instance-trust-change', function (data) {
  var iId = data.instanceId;
  // Set trust level locally, then notify through XMPP if possible.
  _updateTrust(data.instanceId, data.action, false);  // received = false
  var clientId = state.instanceToClient[iId];
  if (!clientId) {
    log.debug('Warning! Cannot change trust level because client ID does not ' +
              'exist for instance ' + iId + ' - they are probably offline.');
    return false;
  }
  identity.sendMessage(clientId, JSON.stringify({type: data.action}));
  return true;
});

// Update trust state for a particular instance.
// |instanceId| - instance to change the trust levels upon.
// |action| - Trust action to execute.
// |received| - boolean of source of this action.
function _updateTrust(instanceId, action, received) {
  received = received || false;
  var asProxy = ['allow', 'deny', 'offer'].indexOf(action) < 0 ? !received : received;
  var trustValue = TrustOp[action];
  var instance = state.instances[instanceId];
  if (asProxy) {
    instance.trust.asProxy = trustValue;
  } else {
    instance.trust.asClient = trustValue;
  }

  // Update UI. TODO(uzimizu): Local storage as well?
  uiChannel.emit('state-change', [{
      op: 'replace', path: '/instances/' + instance.instanceId, value: instance
  }]);
  return true;
}

var _msgReceivedHandlers = {
    'notify-instance': receiveInstance,
    'notify-consent': receiveConsent,
    'update-description': handleUpdateDescription,
    'peerconnection-server' : handleServerSignalToPeer,
    'peerconnection-client' : handleClientSignalToPeer
};

// --------------------------------------------------------------------------
//  Messages
// --------------------------------------------------------------------------
// Bi-directional message handler.
// |beingSent| - True if message is being sent by us. False if we are receiving
// it.
function _handleMessage(msgInfo, beingSent) {
  log.debug(' ^_^ ' + (beingSent ? '----> SEND' : '<---- RECEIVE') +
            ' MESSAGE: ' + JSON.stringify(msgInfo));
  var msgType = msgInfo.data.type;
  var trustValue = TrustOp[msgType];
  if (trustValue) {  // Check if this is a Trust modification. If so, it can
                    //  only be a received message....
    var clientId = msgInfo.fromClientId;
    var instanceId = state.clientToInstance[clientId];
    if (!instanceId) {
      // TODO(uzimizu): Attach instanceId to the message and verify.
      log.error('Could not find instance for the trust modification!');
      return false;
    }
    _updateTrust(instanceId, msgType, true);  // received = true
    return true;
  }

  // Other type of message - instance or proxy state update.
  var handler = null;
  // If the message is not being sent by us...
  if (!beingSent) {
    handler = _msgReceivedHandlers[msgType];
  }
  if (!handler) {
    log.error('No handler for sent message type: ' + msgType);
    return false;
  }
  handler(msgInfo, msgInfo.to);
}

// A simple predicate function to see if we can talk to this client.
function _isMessageableUproxy(client) {
  // TODO(uzimizu): Make identification of whether or not this is a uproxy
  // client more sensible.
  var retval = (client.status == 'online' || client.status == 'messageable')
      && (client.clientId.indexOf('/uproxy') > 0);
  return retval;
}

// Update data for a user, typically when new client data shows up. Notifies all
// new UProxy clients of our instance data, and preserve existing hooks. Does
// not do a complete replace - does a merge of any provided key values.
//
//  |newData| - Incoming JSON info for a single user.
function updateUser(newData) {
  // console.log('Incoming user data from XMPP: ' + JSON.stringify(newData));
  var userId = newData.userId,
      userOp = 'replace',
      existingUser = state.roster[userId];
  if (!existingUser) {
    state.roster[userId] = newData;
    userOp = 'add';
  }
  var user = state.roster[userId];
  var instance = instanceOfUserId(userId);
  var onGoogle = false,   // Flag updates..
      onFB = false,
      online = false,
      canUProxy = false;
  user.name = newData.name;
  user.clients = newData.clients;

  for (var clientId in user.clients) {
    var client = user.clients[clientId];
    if ('offline' == user.status) {  // Delete offline clients
      delete user.clients[clientId];
      continue;
    }
    if (! (clientId in user.clients)) {
      user.clients[clientId] = client;
    }

    // Determine network state / flags for filtering purposes.
    if (!onGoogle && 'google' == client.network)
      onGoogle = true;
    if (!onFB && 'facebook' == client.network)
      onFB = true;

    if (!online && 'manual' != client.network &&
        ('messageable' == client.status || 'online' == client.status)) {
      online = true;
    }

    // Inform UProxy instances of each others' ephemeral clients.
    var isUProxyClient = _checkUProxyClientSynchronization(client);
    canUProxy = canUProxy || isUProxyClient;
  }

  // Apply user-level flags.
  user.online = online;
  user.canUProxy = canUProxy;
  user.onGoogle = onGoogle;
  user.onFB = onFB;
  uiChannel.emit('state-change', [{
      op: userOp,
      path: '/roster/' + userId,
      value: user
  }]);
  return true;
}

// TODO(uzimizu): Figure out best way to request new users to install UProxy if
// they don't have any uproxy clients.

// Examine |client| and synchronize instance data if it's a new UProxy client.
// Returns true if |client| is a valid uproxy client.
function _checkUProxyClientSynchronization(client) {
  if (!_isMessageableUproxy(client)) {
    return false;
  }
  var clientId = client.clientId;
  var clientIsNew = !(clientId in state.clientToInstance);

  if (clientIsNew) {
    log.debug('Aware of new UProxy client. Sending instance data.'
        + JSON.stringify(client));
    // Set the instance mapping to null as opposed to undefined, to indicate
    // that we know the client is pending its corresponding instance data.
    state.clientToInstance[clientId] = null;
    sendInstance(client);
  }
  return true;
}


// --------------------------------------------------------------------------
//  Instance - Client mapping and consent
// --------------------------------------------------------------------------
// The instance data for the local UProxy can be cached, since it is typically
// the same unless something like |description| is explicitly updated. Consent
// bits are sent individually, after initial instance notifications.
function _getMyId() {
  for (var id in state.me.identities) {
    return id;
  }
}
var _myInstanceData = null;
function _fetchMyInstance(resetCache) {
  resetCache = resetCache || false;
  if (!_myInstanceData || resetCache) {
      var me = state.me; // state.me.identities[_getMyId()];
    _myInstanceData = JSON.stringify({
      type: 'notify-instance',
      instanceId: '' + state.me.instanceId,
      description: '' + state.me.description,
      keyHash: '' + state.me.keyHash,
      rosterInfo: {
        userId: me.userId,
        name: me.name,
        network: me.network,
        url: me.url
      }
    });
    log.debug('preparing new instance payload.');
    log.debug(JSON.stringify(me));
    log.debug(_myInstanceData);
  }
  return _myInstanceData;
}

// Send a notification about my instance data to a particular clientId.
// Assumes |client| corresponds to a valid UProxy instance, but does not assume
// that we've received the other side's Instance data yet.
function sendInstance(client) {
  if ('manual' == client.network) {
    return false;
  }
  var instancePayload = _fetchMyInstance();
  log.debug(JSON.stringify(instancePayload));
  identity.sendMessage(client.clientId, instancePayload);
  return true;
}

// Primary handler for synchronizing Instance data. Updates an instance-client
// mapping, and emit state-changes to the UI. In no case will this function fail
// to generate or update an entry of the instance table.
// TODO: support instance being on multiple chat networks.
// Note: does not assume that a roster entry exists for the user that send the
// instance data. Sometimes we get an instance data message from user that is
// not (yet) in the roster.
function receiveInstance(msg) {
  log.debug('receiveInstance(from: ' + msg.fromUserId + ')');
  var instanceId  = msg.data.instanceId,
      userId      = msg.fromUserId,
      clientId    = msg.fromClientId,
      oldClientId = state.instanceToClient[instanceId],
      instanceOp  = 'replace';  // Intended JSONpatch operation.

  // Before everything, remember the clientId - instanceId relation.
  state.clientToInstance[clientId] = instanceId;
  state.instanceToClient[instanceId] = clientId;

  // Obsolete client will never have further communications.
  if (oldClientId && (oldClientId != clientId)) {
    log.debug('Deleting obsolete client ' + oldClientId);
    var user = state.roster[userId];
    if (user) {
      delete user.clients[oldClientId];
    } else {
      log.debug('Warning: no user for ' + userId);
    }
    delete state.clientToInstance[oldClientId];
  }

  // Update the local instance table.
  var instance = state.instances[instanceId];
  if (!instance) {
    instanceOp = 'add';
    instance = _prepareNewInstance(msg.data);
    state.instances[instanceId] = instance;
  } else {
    // If we've had relationships to this instance, send them our consent bits.
    instance.rosterInfo = msg.data.rosterInfo;
    sendConsent(instance);
  }
  _saveInstance(instanceId);

  // TODO: optimise to only save when different to what was in storage before.
  _saveToStorage(StateEntries.INSTANCEIDS,
      Object.keys(state[StateEntries.INSTANCES]));

  _saveInstance(instanceId, userId);
  uiChannel.emit('state-change', [{
      op: instanceOp,
      path: '/instances/' + instanceId,
      value: instance
  }]);
  uiChannel.emit('state-change', [
    { op: 'replace', path: '/clientToInstance', value: state.clientToInstance },
    { op: 'replace', path: '/instanceToClient', value: state.instanceToClient }
  ]);
  return true;
}

// Prepare and return new instance object. Assumes new |instanceId|.
function _prepareNewInstance(data) {
  var instance = DEFAULT_INSTANCE;
  instance.instanceId = data.instanceId;
  instance.description = data.description;
  instance.keyHash = data.keyHash;
  instance.rosterInfo = data.rosterInfo;
  log.debug('Prepared NEW Instance: ' + JSON.stringify(instance));
  return instance;
}

// Send consent bits to re-synchronize consent with remote |instance|.
// This happens *after* receiving an instance notification for an instance which
// we already have a history with.
function sendConsent(instance) {
  var clientId = state.instanceToClient[instance.instanceId];
  if (!clientId) {
    log.error('Instance ' + instance.instanceId + ' missing clientId!');
    return false;
  }
  var consentPayload = JSON.stringify({
    type: 'notify-consent',
    instanceId: state.me.instanceId,            // Our own instanceId.
    consent: _determineConsent(instance.trust)  // My consent.
  });
  identity.sendMessage(clientId, consentPayload);
  return true;
}

// Assumes that when we receive consent there is a roster entry.
// But does not assume there is an instance entry for this user.
function receiveConsent(msg) {
  if (! (msg.fromUserId in state.roster)) {
    console.error("msg.fromUserId (" + msg.fromUserId +
        ") is not in the roster");
  }
  log.debug('receiveConsent(from: ' + msg.fromUserId + '): ' +
            JSON.stringify(msg));
  var consent     = msg.data.consent,     // Their view of consent.
      instanceId  = msg.data.instanceId,  // InstanceId of the sender.
      instance    = state.instances[instanceId];
  if (!instance) {
    log.error('Instance for id: ' + instanceId + ' not found!');
    return false;
  }
  // Determine my own consent bits, compare with their consent and remap.
  var myConsent = _determineConsent(instance.trust);
  instance.trust.asProxy = consent.asProxy?
      (myConsent.asClient? 'yes' : 'offered') :
      (myConsent.asClient? 'requested' : 'no');
  instance.trust.asClient = consent.asClient?
      (myConsent.asProxy? 'yes' : 'requested') :
      (myConsent.asProxy? 'offered' : 'no');
  _saveInstance(instanceId);
  // _SyncUI('/instances/' + instanceId + '/trust', instance.trust);
  _SyncInstance(instance, 'trust');
  return true;
}

// For each direction (e.g., I proxy for you, or you proxy for me), there
// is a logical AND of consent from both parties. If the local state for
// trusting them to be a proxy (trust.asProxy) is Yes or Requested, we
// consent to being their client. If the local state for trusting them to
// be our client is Yes or Offered, we consent to being their proxy.
function _determineConsent(trust) {
  return { asProxy:  ["yes", "offered"].indexOf(trust.asClient) >= 0,
           asClient: ["yes", "requested"].indexOf(trust.asProxy) >= 0 };
}

function _validateKeyHash(keyHash) {
  log.debug('Warning: keyHash Validation not yet implemented...');
  return true;
}

// Update the description for an instanceId.
// Assumes that |instanceId| is valid.
function handleUpdateDescription(msg) {
  log.debug('Updating description! ' + JSON.stringify(msg));
  var description = msg.data.description,
      instanceId = msg.data.instanceId,
      instance = state.instances[instanceId];
  if (!instance) {
    log.error('Could not update description - no instance: ' + instanceId);
    return false;
  }
  instance.description = description;
  // _SyncUI('/instances/' + instanceId + '/description', description);
  _SyncInstance(instance, 'description');
  return true;
}

// --------------------------------------------------------------------------
//  Updating the UI
// --------------------------------------------------------------------------
function _SyncUI(path, value, op) {
  op = op || 'replace';
  uiChannel.emit('state-change', [{
      op: op,
      path: path,
      value: value
  }]);
}
// Helper to consolidate syncing the instance on the UI side.
function _SyncInstance(instance, field) {
  var fieldStr = field? '/' + field : '';
  _SyncUI('/instances/' + instance.instanceId + fieldStr,
          field? instance[field] : instance);
}

function _Login(network) {
  network = network || undefined;
  identity.login({
    agent: 'uproxy',
    version: '0.1',
    url: 'https://github.com/UWNetworksLab/UProxy',
    interactive: Boolean(network),
    network: network
  }, sendFullStateToUI);
  if (network) {
    _saveNetworkState(network, true);
  }
}

// Load state from storage and when done, emit an total state update.
_loadStateFromStorage(state, function () { });

// Only logon to networks if local storage says we were online previously.
checkPastNetworkConnection(VALID_NETWORKS.GOOGLE);
checkPastNetworkConnection(VALID_NETWORKS.FACEBOOK);

// Now that this module has got itself setup, it sends a 'ready' message to the
// freedom background page.
uiChannel.emit('ready');

//TODO(willscott): WebWorkers startup errors are hard to debug.
// Once fixed, the setTimeout will no longer be needed.
//};  // onload
//setTimeout(onload, 0);
