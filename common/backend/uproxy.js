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

//
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
  //     name: string,
  //     description: string,
  //     annotation: string,
  //     instanceId: string,
  //     userId: string,
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

// Instance object.
var DEFAULT_INSTANCE = {
  instanceId: null,  // Primary key.
  keyHash: null,
  trust: {
    asProxy: Trust.NO,
    asClient: Trust.NO
  },
  description: ''
};

function onload() {


// --------------------------------------------------------------------------
//  Local Storage
// --------------------------------------------------------------------------
// To see the format used by localstorage, see the file:
//   scraps/local_storage_example.js
function _loadFromStorage(key, callback, defaultIfUndefined) {
  storage.get(key).done(function (result) {
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

// TODO: Generalise to a simple type system & checker for JS.
function _validateStoredInstance(instanceId, instanceData) {
  var ids = [ "name", "description", "annotation", "instanceId", "userId", "network", "keyHash", "trust" ];
  for (var i = 0; i < ids.length; ++i) {
    var id = ids[i];
    if (instanceData[id] === undefined) {
      log.debug("_validateStoredInstance: Rejecting instanceId " + instanceId + " for missing key " + id);
      return false;
    }
  }
  // TODO: use Trust enum.
  var testTrustValue = function(variable) {
    if (instanceData.trust[variable] === undefined) {
      return false;
    }
    var value = instanceData.trust[variable];
    if (value != "yes" && value != "no" && value != "requested" && value != "offered") {
      return false;
    }
    return true;
  };

  if (!testTrustValue('asProxy') || !testTrustValue('asClient')) {
    log.debug("_validateStoredInstance: Rejecting instanceId " + instanceId + " for trust value " +
        JSON.stringify(instanceData.trust));
    return false;
  }
  return true;
}


function _loadStateFromStorage(state, callback) {
  var i, val, hex, id, key, instanceIds = [];

  var finalCallbacker = new FinalCallback(callback);

  // Set the saves |me| state and |options|.  Note that in both of
  // these callbacks |key| will be a different value by the time they
  // run.
  key = StateEntries.ME;
  var maybeCallbackAfterLoadingMe = finalCallbacker.makeCountedCallback();
  _loadFromStorage(key, function(v){
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
  _loadFromStorage(key, function(v){
    state[StateEntries.OPTIONS] = v;
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
      if(instance === null) {
        console.error("instance " + instanceId + " not found");
      } else if (!_validateStoredInstance(instanceId, instance)) {
        console.error("instance " + instanceId + " was bad:", instance);
        _removeInstanceId(instanceId);
      } else {
        console.log("instance " + instanceId + " loaded");
        instances[instanceId] = instance;
        // Add to the roster also
        var user = state.roster[instance.userId] = {};
        user.userId = instance.userId;
        user.name = instance.name;
        user.url = '';
        user.clients = {};
      }
      maybeCallbackAfterLoadingInstance();
    }, null);
  };

  // Load
  _loadFromStorage(StateEntries.INSTANCEIDS, function(insts) {
    var instanceIds = [];
    if (insts !== null && insts.length > 0) {
      instanceIds = JSON.parse(insts);
    }
    console.log('instanceIds:' + instanceIds);
    for (i = 0; i < instanceIds.length; i++) {
      //if (instanceIds[i] == "undefined") {
      //  _removeInstanceId("undefined");
      //} else {
        // Check, save and update the UI on the last loaded entry.
      checkAndSave(instanceIds[i]);
      //}
    }
  }, []);

  log.debug('_loadStateFromStorage: loaded: ' + JSON.stringify(state));
}


// Save the instance to local storage. Assumes that both the Instance
// notification and XMPP user nad client information exists and is up-to-date.
// |instanceId| - string instance identifier (a 40-char hex string)
// |userId| - The userId such as 918a2e3f74b69c2d18f34e6@public.talk.google.com.
function _saveInstance(instanceId, userId) {
  // Be obscenely strict here, to make sure we don't propagate buggy
  // state across runs (or versions) of UProxy.
  var instanceInfo = state.instances[instanceId];
  var msg = { name: state.roster[userId].name,
              description: instanceInfo.description,
              annotation: getKeyWithDefault(instanceInfo, 'annotation', instanceInfo.description),
              instanceId: instanceId,
              userId: userId,
              network: getKeyWithDefault(state.roster[userId].clients[instanceInfo.clientId],
                                         'network', "xmpp"),
              keyHash: instanceInfo.keyHash,
              trust: instanceInfo.trust,
            };
  log.debug('_saveInstance: saving "instance/"' + instanceId + '": ' + JSON.stringify(msg));
  _saveToStorage("instance/" + instanceId, msg);
}

// Update the list of instanceIds to include instanceId.
function _saveInstanceId(instanceId) {
  log.debug('_saveInstanceId: saving ' + instanceId + '.');
  _loadFromStorage(StateEntries.INSTANCEIDS, function (ids) {
    console.log('_saveInstanceId got: ' + ids);
    if (ids !== undefined && ids !== null) {
      var instanceids = JSON.parse(ids);
      if (instanceids.indexOf(instanceId) < 0) {
        console.log('_saveInstanceId: -- new value: ' +
            JSON.stringify(instanceids) + ', type: ' +
            typeof(instanceids) + '.');
        instanceids.push(instanceId);
        _saveToStorage(StateEntries.INSTANCEIDS, JSON.stringify(instanceids));
      }
    } else {
      log.debug('_saveInstanceId: -- new value: ' + JSON.stringify([instanceId]) + '.');
      _saveToStorage(StateEntries.INSTANCEIDS, JSON.stringify([instanceId]));
    }
  }, []);
}

function _removeInstanceId(instanceId) {
  storage.remove("instance/" + instanceId);
  log.debug('_removeInstanceId: removing ' + instanceId + '.');
  _loadFromStorage(StateEntries.INSTANCEIDS, function (ids) {
    console.log('_removeInstanceId got: ', ids);
    if (ids !== undefined && ids !== null) {
      var instanceids = JSON.parse(ids);
      var index = instanceids.indexOf(instanceId);
      if (index >= 0) {
        instanceids.splice(index,1);
        _saveToStorage(StateEntries.INSTANCEIDS, JSON.stringify(instanceids));
      }
    }
  }, null);
}

function _saveAllInstances() {
  // Go through |roster.client[*].clients[*]|, and save every instance
  // with an instanceId.  We pull data from both the|state.instances|
  // and |state.roster| objects.
  for (var userId in state.roster) {
    for (var clientId in state.roster[userId]) {
      var rosterClient = state.roster[userId].clients[clientId];
      if (rosterClient.instanceId !== undefined && rosterClient.instanceId) {
        _saveInstance(rosterClient.instanceId, userId);
      }
    }
  }
  // Now save the entire instanceIds list.
  _saveToStorage(StateEntries.INSTANCEIDS, JSON.stringify(
      Object.keys(state[StateEntries.INSTANCES])));
}

// --------------------------------------------------------------------------
//  General UI interaction
// --------------------------------------------------------------------------

// Try to login to chat networks.
identity.login({
  agent: 'uproxy',
  version: '0.1',
  url: 'https://github.com/UWNetworksLab/UProxy',
  interactive: false
  //network: ''
});

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

// Load state from storage and when done, emit an total state update.
_loadStateFromStorage(state, function () {
});

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
        [{op: 'add', path: '/identityStatus/'+data.network, value: data}]);
    if (!state.me[data.userId]) {
      state.me[data.userId] = {userId: data.userId};
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
  if (state.me[data.userId]) {
    // My card changed
    state.me[data.userId] = data;
    _SyncUI('/me' + data.userId, data, 'add');
    // TODO: Handle changes that might affect proxying
  } else {
    _updateUser(data);  // Not myself.
  }
});

identity.on('onMessage', function (msgInfo) {
  log.debug("identity.on('onMessage'): msgInfo: ", msgInfo);
  state._msgLog.push(msgInfo);
  uiChannel.emit('state-change',
      [{op: 'add', path: '/_msgLog/-', value: msgInfo}]);
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
  identity.login({
    agent: 'uproxy',
    version: '0.1',
    url: 'https://github.com/UWNetworksLab/UProxy',
    interactive: true,
    network: network
  });
});

uiChannel.on('logout', function(network) {
  identity.logout(null, network);
  // Clear the clientsToInstance table.
  state.clientToInstance = {};
});

uiChannel.on('ignore', function (userId) {
  // TODO: fix.
});

uiChannel.on('invite-friend', function (userId) {
  identity.sendMessage(userId, "Join UProxy!");
});

uiChannel.on('echo', function (msg) {
  state._msgLog.push(msg);
  uiChannel.emit('state-change', [{op: 'add', path: '/_msgLog/-', value: msg}]);
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
//  Proxying
// --------------------------------------------------------------------------
// TODO: should we lookup the instance ID for this client here?
// TODO: say not if we havn't given them permission :)
uiChannel.on('start-using-peer-as-proxy-server', function(peerClientId) {
  startUsingPeerAsProxySever(peerClientId);
});

client.on('sendSignalToPeer', function(data) {
  log.debug('client(sendSignalToPeer):', data);
  // TODO: don't use 'message' as a field in a message! that's confusing!
  identity.sendMessage(contact, JSON.stringify({type: 'peerconnection-client', data: data}));
});

server.on('sendSignalToPeer', function(data) {
  log.debug('server(sendSignalToPeer):', data);
  identity.sendMessage(contact, JSON.stringify({type: 'peerconnection-server', data: data}));
});

function startUsingPeerAsProxyServer(peerClientId) {
  // TODO: check permission first.
  state.me.peerAsProxy = peerClientId;
  uiChannel.emit('state-change',
      [{op: 'replace', path: '/me/peerAsProxy', value: peerClientId}]);

  // TODO: sync properly between the extension and the app on proxy settings
  // rather than this cooincidentally the same data.
  client.emit("start",
    {'host': '127.0.0.1', 'port': 9999,
      // peerId of the peer being routed to.
     'peerId': peerClientId});
}

function stopUsingPeerAsProxyServer(peerClientId) {
  // TODO: check permission first.
  state.me.peerAsProxy = null;
  uiChannel.emit('state-change',
      [{op: 'replace', path: '/me/peerAsProxy', value: ''}]);
  client.emit("stop");
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
  'accept-access': Trust.YES
};

// Update trust level for an instance.
uiChannel.on('instance-trust-change', function (data) {
  var iId = data.instanceId,
      clientId = state.instanceToClient[iId];
  if (!clientId) {
    log.debug('Warning! Cannot change trust level because client ID does not ' +
              'exist for instance ' + iId + ' - they are probably offline.');
    return false;
  }
  // Set trust level locally, then notify the other end through XMPP.
  _updateTrust(data.instanceId, data.action, false);  // received = false
  identity.sendMessage(clientId, JSON.stringify({type: data.action}));
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
  'notify-instance': _receiveInstanceData,
  'notify-consent': _receiveConsent,
  'update-description': _handleUpdateDescription
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
function _updateUser(newData) {
  console.log('Incoming user data from XMPP: ' + JSON.stringify(newData));
  var userId = newData.userId,
      userOp = 'replace',
      existingUser = state.roster[userId];
  if (!existingUser) {
    state.roster[userId] = newData;
    userOp = 'add';
  }
  var user = state.roster[userId];
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

  // TODO(mollyling): Properly hangle logout: remove client.
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
    log.debug('Aware of new UProxy client. Sending instance data.' + JSON.stringify(client));
    // Set the instance mapping to null as opposed to undefined, to
    // indicate that
    // we know the client is pending its corresponding instance data.
    state.clientToInstance[clientId] = null;
    _sendInstanceData(client);
  }
  return true;
}


// --------------------------------------------------------------------------
//  Instance - Client mapping and consent
// --------------------------------------------------------------------------
// The instance data for the local UProxy can be cached, since it is typically
// the same unless something like |description| is explicitly updated. Consent
// bits are sent individually, after initial instance notifications.
var _myInstanceData = null;
function _fetchMyInstance() {
  if (!_myInstanceData) {
    _myInstanceData = JSON.stringify({
      type: 'notify-instance',
      instanceId: '' + state.me.instanceId,
      description: '' + state.me.description,
      keyHash: '' + state.me.keyHash
    });
    log.debug('Caching local instance payload: ' + _myInstanceData);
  }
  return _myInstanceData;
}

// Send a notification about my instance data to a particular clientId.
// Assumes |client| corresponds to a valid UProxy instance, but does not assume
// that we've received the other side's Instance data yet.
function _sendInstanceData(client) {
  if ('manual' == client.network) {
    return false;
  }
  identity.sendMessage(client.clientId, _fetchMyInstance());
}

// Primary handler for synchronizing Instance data. Updates an instance-client
// mapping, and emit state-changes to the UI. In no case will this function fail
// to generate or update an entry of the instance table.
// TODO: support instance being on multiple chat networks.
function _receiveInstanceData(msg) {
  log.debug('_receiveInstanceData(from: ' + msg.fromUserId + ')');
  var instanceId  = msg.data.instanceId,
      description = msg.data.description,
      keyHash     = msg.data.keyHash,
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
    delete state.roster[userId].clients[oldClientId];
    delete state.clientToInstance[oldClientId];
  }

  // Update the local instance table.
  var instance = state.instances[instanceId];
  if (!instance) {
    instanceOp = 'add';
    instance = _prepareNewInstance(instanceId, userId, description, keyHash);
    state.instances[instanceId] = instance;
  } else {
    // If we've had relationships to this instance, send them our consent bits.
    _sendConsent(instance);
  }

  // Update local storage and extension.
  _saveInstanceId(instanceId);
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
function _prepareNewInstance(instanceId, userId, description, keyHash) {
  var instance = DEFAULT_INSTANCE;
  instance.instanceId = instanceId;
  instance.userId = userId;
  instance.description = description;
  instance.keyHash = keyHash;
  log.debug('Prepared NEW Instance: ' + JSON.stringify(instance));
  return instance;
}

// Send consent bits to re-synchronize consent with remote |instance|.
// This happens *after* receiving an instance notification for an instance which
// we already have a history with.
function _sendConsent(instance) {
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

// Receive consent bits and re-synchronize the relation between instances.
function _receiveConsent(msg) {
  log.debug('_receiveConsent(from: ' + msg.fromUserId + ')');
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
  _saveInstanceId(instanceId);
  _SyncUI('/instances/' + instanceId + '/trust', instance.trust);
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
function _handleUpdateDescription(msg) {
  log.debug('Updating description! ' + JSON.stringify(msg));
  var instanceId = msg.data.instanceId,
      description = msg.data.description;

  state.instances[instanceId].description = description;
  _SyncUI('/instances/' + instanceId + '/description', description);
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



// Now that this module has got itself setup, it sends a 'ready' message to the
// freedom background page.
uiChannel.emit('ready');

//TODO(willscott): WebWorkers startup errors are hard to debug.
// Once fixed, the setTimeout will no longer be needed.
};  // onload
setTimeout(onload, 0);
