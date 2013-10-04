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

/*global self, makeLogger, freedom, cloneDeep, isDefined, nouns, adjectives */   // for jslint.
var DEBUG = true; // XXX get this from somewhere else
console.log('Uproxy backend, running in worker ' + self.location.href);

var log = {
  debug: DEBUG ? makeLogger('debug') : function(){},
  error: makeLogger('error')
};

var identity = freedom.identity();
var storage = freedom.storage();
var client = freedom.uproxyclient();
var server = freedom.uproxyserver();

var window = {};  //XXX: Makes chrome debugging saner, not needed otherwise.

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
var TrustType = {
  PROXY: 'asProxy',
  CLIENT: 'asClient'
};

// Keys that we don't save to local storage each time.
// Format: each key is a dot-delimited path.
// TODO(mollying): allow * to denote any-value for a single element of
// a path.
var TRANSIENT_STATE_KEYS = [];

// Initial empty state
var RESET_STATE = {
  // debugging stuff
  "_debug": DEBUG,  // debug state.
  "_msgLog": [],  //

  // A table from network identifier to your status on that network
  // (online/offline/idle, etc)
  "identityStatus": {},
  "me": {},         // Local client's information.
  "roster": {},     // Merged contact lists from each identity provider.
  "instances": {},  // instanceId -> instance. Active UProxy installations.

  // Options coming from local storage and setable by the options page.
  "options": {
    "allowNonRoutableAddresses": false,
    "stunServers": ["stunServer1", "stunServer2"],
    "turnServers": ["turnServer1", "turnServer2"]
  }
};
var state = cloneDeep(RESET_STATE);
var _clients = {};  // clientId -> client reference table.

// Mapping functions between instanceIds and clientIds.
function instanceToClientId(instanceId) {
  var instance = state.instances[instanceId];
  if (!instance) { return null; }
  return instance.clientId;
}

// clientId -> Instance object
function clientToInstance(clientId) {
  var client = _clients[clientId];
  log.debug('meow! ', _clients);
  log.debug('finding instance for client ' + clientId, client);
  if (!client) { return null; }
  log.debug('lol! ', state.instances);
  return state.instances[client.instanceId];
}

// Instance object.
var DEFAULT_INSTANCE = {
  instanceId: null,  // Primary key.
  clientId: null,    // May change many times.
  keyHash: null,
  trust: {
    asProxy: Trust.NO,
    asClient: Trust.NO
  },
  description: ''
};

// Mock data for what may live in local storage. (note: values will be strings
// too, via JSON interpretation)
var LOCAL_STORAGE_EXAMPLE = {
  'me': { 'description': 'l\'s Laptop',
          'instanceId': 'mememmemememsdhodafslkffdaslkjfds',
        },
  'options': {
    'allowNonRoutableAddresses': false,
    'stunServers': ['stunServer1', 'stunServer2'],
    'turnServers': ['turnServer1', 'turnServer2']
  },
  // Note invariant: for each instanceIds[X] there should be an entry:
  // 'instance/X': { ... } which holds out local stored knowledge about that
  // instance id.
  'instanceIds': [
    'ssssssssshjafdshjadskfjlkasfs',
    'rrrrrrhjfhjfjnbmnsbfdbmnfsdambnfdsmn',
    'qqqqjksdklflsdjkljkfdsa'
  ],
  'instance/ssssssssshjafdshjadskfjlkasfs': {
    'name': 'S',
    'description': 'S\'s home desktop',
    'annotation': 'Cool S who has high bandwidth',
    'instanceId': 'ssssssssshjafdshjadskfjlkasfs',
    'userId': 's@gmail.com',
    'network': 'google',
    'keyhash' : 'HASHssssjklsfjkldfslkfljkdfsklas',
    'trust':
      { 'proxy': 'yes', // 'no' | 'requested' | 'yes'
        'client': 'no' // 'no' | 'requested' | 'yes'
      }
    // 'status' {
       // 'activeProxy': boolean
       // 'activeClient': boolean
    // }
  },
  'instance/r@fmail.com': {
    'name': 'R',
    'description': 'R\'s laptop',
    'annotation': 'R is who is repressed',
    'instanceId': 'rrrrrrhjfhjfjnbmnsbfdbmnfsdambnfdsmn',
    'userId': 'r@facebook.com',
    'network': 'facebook',
    'keyhash' : 'HASHrrrjklsfjkldfslkfljkdfsklas',
    'trust': {
      'proxy': 'no',
      'client': 'yes'
    }
  },
  'instance/qqqqjksdklflsdjkljkfdsa': {
    'name': 'S',
    'description': 'S\'s laptop',
    'annotation': 'S who is on qq',
    'instanceId': 'qqqqjksdklflsdjkljkfdsa',
    'userId': 's@qq',
    'network': 'manual',
    'keyhash' : 'HASHqqqqqjklsfjkldfslkfljkdfsklas',
    'trust': {
      'proxy': 'no',
      'client': 'no'
    }
  }
};

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

function _validateStoredInstance(instanceId, instanceData) {
  var ids = [ "name", "description", "annotation", "instanceId", "userId", "network", "keyHash", "trust" ];
  for (var i = 0; i < ids.length; ++i) {
    var id = ids[i];
    if (instanceData[id] === undefined) {
      log.debug("_validateStoredInstance: Rejecting instanceId " + instanceId + " for missing key " + id);
      return false;
    }
  }
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

function _loadStateFromStorage(state) {
  var i, val, hex, id, key, instanceIds = [];

  // Set the saves |me| state and |options|.  Note that in both of
  // these callbacks |key| will be a different value by the time they
  // run.
  key = StateEntries.ME;
  _loadFromStorage(key, function(v){
    if (v === null) {
      // Create an instanceId if we don't have one yet.
      state.me.instanceId = '';
      state.me.description = null;
      state.me.keyHash = '';
      // Just generate 20 random 8-bit numbers, print them out in hex.
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
  }, null);

  key = StateEntries.OPTIONS;
  _loadFromStorage(key, function(v){ state[StateEntries.OPTIONS] = v; }, RESET_STATE[key]);

  // Set the state |instances| from the local storage entries.
  var instancesTable = {};
  state[StateEntries.INSTANCES] = instancesTable;
  key = StateEntries.INSTANCEIDS;
  var checkAndSave = function(instanceId) {
    _loadFromStorage("instance/" + instanceId, function(v) {
      if(v === null) {
        console.log("instance " + instanceId + " not found");
      } else if (!_validateStoredInstance(instanceId, v)) {
        console.log("instance " + instanceId + " was bad:", v);
        _removeInstanceId(instanceId);
      } else {
        instancesTable[instanceId] = v;
      }
    }, null);
  };

  _loadFromStorage(StateEntries.INSTANCEIDS, function(insts) {
    var instanceIds = [];
    if (insts !== null && insts.length > 2) {
      instanceIds = JSON.parse(insts);
    }
    console.log('instanceIds:' + instanceIds);
    for (i = 0; i < instanceIds.length; i++) {
      if (instanceIds[i] == "undefined") {
        _removeInstanceId("undefined");
      } else {
        checkAndSave(instanceIds[i]);
      }
    }
  }, []);

  // TODO: remove these and propegate changes.
  state.currentSessionsToInitiate = {};
  state.currentSessionsToRelay = {};
  log.debug('_loadStateFromStorage: loaded: ' + JSON.stringify(state));
}

// Local storage mechanisms.

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
        console.log('_saveInstanceId: -- new value: ' + JSON.stringify(instanceids) + ', type: ' +
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

//TODO(willscott): WebWorkers startup errors are hard to debug.
// Once fixed, the setTimeout will no longer be needed.
setTimeout(onload, 0);

function _loginInit(cb) {
  identity.login({
    agent: 'uproxy',
    version: '0.1',
    url: 'https://github.com/UWNetworksLab/UProxy',
    interactive: false
    //network: ''
  }).done(function (loginRet) {
    if (cb) {
      cb();
    }
  });
};

/**
 * Called once when uproxy.js is loaded.
 */
function onload() {
  // Check if the app is installed.
  _loginInit();
  _loadStateFromStorage(state);

  // Define freedom bindings.
  freedom.on('reset', function () {
    log.debug('reset');
    // TODO: sign out of Google Talk and other networks.
    state = cloneDeep(RESET_STATE);
    _loadStateFromStorage(state);
  });

  // Called from extension whenever the user clicks opens the extension popup.
  // The intent is to reset its model - but this may or may not always be
  // necessary. Improvements to come.
  freedom.on('open-popup', function () {
    log.debug('open-popup');
    log.debug('state:', state);
    // Send the extension an empty state object.
    freedom.emit('state-change', [{op: 'replace', path: '', value: state}]);
  });

  // Update local user's online status (away, busy, etc.).
  identity.on('onStatus', function(data) {
    log.debug('onStatus: data:' + JSON.stringify(data));
    if (data.userId) {
      state.identityStatus[data.network] = data;
      freedom.emit('state-change', [{op: 'add', path: '/identityStatus/'+data.network, value: data}]);
      if (!state.me[data.userId]) {
        state.me[data.userId] = {userId: data.userId};
      }
    }
  });

  // Called when a contact (or ourselves) changes online-status
  identity.on('onChange', function(data) {
    // log.debug('onChange: data:' + JSON.stringify(data));
    if (data.userId && state.me[data.userId]) {
      // My card changed
      state.me[data.userId] = data;
      freedom.emit('state-change', [{op: 'add', path: '/me/'+data.userId, value: data}]);
      notifyClient();
      notifyServer();
    } else {
      // Must be a buddy
      state.roster[data.userId] = _updateUser(data);
      // Determine networks and uproxy state.
      freedom.emit('state-change', [{op: 'add', path: '/roster/'+data.userId, value: data}]);
    }
  });

  identity.on('onMessage', function (msg) {
    state._msgLog.push(msg);
    freedom.emit('state-change', [{op: 'add', path: '/_msgLog/-', value: msg}]);
    var payload = {};
    try {
      payload = JSON.parse(msg.message);
      msg.message = payload.message;
      msg.data = payload.data;
    } catch(e) {
      msg.unparseable = msg.message;
    }
    _handleMessage(msg, false);  // beingSent = false
  });

  freedom.on('login', function(network) {
    identity.login({
      agent: 'uproxy',
      version: '0.1',
      url: 'https://github.com/UWNetworksLab/UProxy',
      interactive: true,
      network: network
    });
  });

  freedom.on('logout', function(network) {
    identity.logout(null, network);
    // Clear clients so that the next logon propogates instance data correctly.
    _clients = {};
  });

  freedom.on('send-message', function (msg) {
    identity.sendMessage(msg.to, msg.message);
    _handleMessage(msg, true);  // beingSent = true
  });

  freedom.on('ignore', function (userId) {
    // TODO: fix.
  });

  freedom.on('invite-friend', function (userId) {
    identity.sendMessage(userId, "Join UProxy!");
  });

  freedom.on('echo', function (msg) {
    state._msgLog.push(msg);
    freedom.emit('state-change', [{op: 'add', path: '/_msgLog/-', value: msg}]);
  });

  freedom.on('change-option', function (data) {
    state.options[data.key] = data.value;
    _saveToStorage('options', state.options);
    log.debug('saved options ' + JSON.stringify(state.options));
    freedom.emit('state-change', [{op: 'replace', path: '/options/'+data.key, value: data.value}]);
    notifyClient();
    notifyServer();
  });

  client.on('fromClient', function(data) {
    log.debug('Connection Setup:', data);
    var contact = state.currentSessionsToInitiate['*'];
    if (!contact) {
      return log.error("Client connection received but no active connections.");
    }
    identity.sendMessage(contact, JSON.stringify({message: 'connection-setup', data: data}));
  });

  server.on('fromServer', function(data) {
    log.debug('server response:', data);
    var contact = state.currentSessionsToRelay[data.to];
    if(!contact) {
      return log.error("Response requested to inactive client: " + data.to);
    }
    identity.sendMessage(contact, JSON.stringify({message: 'connection-setup-response', data: data}));
  });

};

var notifyClient = function() {
  if (client.started && !('*' in state.currentSessionsToInitiate)) {
    client.emit('stop');
    client.started = false;
  } else if (!client.started && ('*' in state.currentSessionsToInitiate)) {
    client.emit('start', {host: '127.0.0.1', port: 9999});
    client.started = true;
  }
};

var notifyServer = function() {
  if (server.started && Object.keys(state.currentSessionsToRelay).length == 0) {
    server.emit('stop');
    server.started = fale;
  } else if (!server.started && Object.keys(state.currentSessionsToRelay).length > 0) {
    server.emit('start');
    server.started = true;
  }
}

// These message handlers must operate on a per-instance basis rather than a
// per-user basis...
// Each of these functions should take parameters (msg, contact)
// Some of these message handlers deal with modifying trust values.
// Others deal with actually starting and stopping a proxy connection.

// Trust mutation - map from message -> new trust level.
var TrustOp = {
  'allow': Trust.YES,
  'offer': Trust.OFFERED,
  'deny': Trust.NO,
  'request-access': Trust.REQUESTED,
  'cancel-request': Trust.NO,
  'accept-access': Trust.YES
};

var _msgReceivedHandlers = {
  'start-proxying': _handleProxyStartReceived,
  'connection-setup': _handleConnectionSetupReceived,
  'connection-setup-response': _handleConnectionSetupResponseReceived,
  'notify-instance' : _handleNotifyInstanceReceived,
};

/**
 * Bi-directional message handler.
 *
 * @isSent - True if message is being sent. False if received.
 */
function _handleMessage(msg, beingSent) {
  log.debug(' ^_^ ' + (beingSent ? '--> SEND' : '<-- RECEIVE') +
            ' MESSAGE: ' + JSON.stringify(msg));

  // Check if this is a Trust modification.
  var trustValue = TrustOp[msg.message];  // NO, REQUESTED, or YES
  if (trustValue) {
    // Access request and Grants go in opposite directions - tweak boolean.
    var asProxy = 'allow' == msg.message || 'deny' == msg.message ||
                  'offer' == msg.message ? !beingSent : beingSent;
    var clientId = msg.to || msg.toClientId;
    if (!beingSent) {  // Update trust on the remote instance if received.
      clientId = msg.fromClientId;
    }
    _updateTrust(clientId, asProxy, trustValue);
    return true;
  }

  // Other type of message - instance or proxy state update.
  var handler = null;
  if (!beingSent) {
    handler = _msgReceivedHandlers[msg.message];
  }
  if (!handler) {
    log.error('No handler for sent message: ', msg);
    return false;
  }
  handler(msg, msg.to);
}

// A simple predicate function to see if we can talk to this client.
function _isMessageableUproxy(client) {
  // TODO(uzimizu): Make identification of whether or not this is a uproxy
  // client more sensible.
  var retval = (/* [issue 21] client.network == 'google' && */ client.status == 'online'
      && client.clientId.indexOf('/uproxy') > 0) || client.status == 'messageable';
  return retval;
}

/**
 * Update client and instance information for a user. For each active UProxy
 * client, synchronize Instance data if it's a new clientId. Otherwise, preserve
 * the instanceId to maintain data hooks between client and instance.
 *
 * @param {object} newData Incoming JSON info for a single user.
 */
function _updateUser(newData) {
  var userId = newData.userId;
  for (var clientId in newData.clients) {
    log.debug('_updateUser: client: ' + clientId);
    var client = newData.clients[clientId];
    // Skip non-UProxy clients.
    // TODO(uzimizu): Figure out best way to request new UProxy users...
    if (!_isMessageableUproxy(client)) {
      continue;
    }

    // Synchronize Instance data if this is a new client.
    var existingClient = _clients[clientId];
    log.debug('Existing client: ', existingClient);
    if (!existingClient) {
      log.debug('_updateUser: deciding to message ' + JSON.stringify(client));
      _sendNotifyInstance(clientId, client);
    } else if (existingClient.instanceId) { // Otherwise, preserve existing instance id.
      log.debug('Preserving data. ' + existingClient.instanceId);
      client.instanceId = existingClient.instanceId;
    }
    _clients[clientId] = client;
    // TODO(mollyling): Properly hangle logout.
  }
  return newData;  // Overwrites the userdata.
}

function _updateTrust(clientId, asProxy, trustValue) {
  var instance = clientToInstance(clientId);
  log.debug(instance);
  if (!instance) {
    log.debug('Could not find instance corresponding to client: ' + clientId);
    return false;
  }
  var trust = asProxy? instance.trust.asProxy : instance.trust.asClient;
  log.debug('Modifying trust value: ', instance, trust);
  if (asProxy) {
    instance.trust.asProxy = trustValue;
  } else {
    instance.trust.asClient = trustValue;
  }
  // TODO(uzimizu): local storage?
  freedom.emit('state-change', [{
      op: 'replace', path: '/instances/' + instance.instanceId, value: instance
  }]);
  return true;
}

function _handleProxyStartReceived(msg, contact) {
  // TODO: Access Check on if it's allowed.
  state.currentSessionsToRelay[msg['fromClientId']] = msg['fromClientId'];
  _saveToStorage('currentSessionsToRelay', state.currentSessionsToRelay);
  notifyServer();
  freedom.emit('state-change', [{op: 'add', path: '/currentSessionsToRelay/' +
      msg['fromClientId'], value: contact}]);
}

function _handleConnectionSetupReceived(msg, contact) {
  msg.data.from = msg['fromClientId'];
  server.emit('toServer', msg.data);

  // Figure out the crypto key
  var cryptoKey = null;
  var data = JSON.parse(msg.data.data);
  if (data.sdp) {
    cryptoKey = extractCryptoKey(data.sdp);
  } else {
    log.debug("Data did not contain sdp headers", msg);
  }

  // Compare against the verified crypto keys
  var verifiedCryptoKeysKey = contact.userId + ".verifiedCryptoKeys";
  var verificationRequired = false;
  if (cryptoKey) {
    // TODO: rename to Hash: this is not the key, this is the hash of the key.
    _loadFromStorage(verifiedCryptoKeysKey, function(verifiedCryptoKeys) {
      log.debug("Comparing crypto key against verified keys for this user");
      if (cryptoKey in verifiedCryptoKeys) {
        log.debug("Crypto key already verified, proceed to establishing connection");
      } else {
        log.debug("Crypto key not yet verified, need to start video chat");
      }
    }, {});
  } else {
    log.error("Didn't receive crypto key in SDP headers, not sure what to do");
  }
}

function _handleConnectionSetupResponseReceived(msg, clientId) {
  // msg.data.from = msg['fromClientId'];
  // client.emit('toClient', msg.data);
}

// Handle sending -----------------------------------------------------------

function _handleStartProxyingSent(msg, clientId) {
  //TODO replace with better handling of manual identity
  if (msg.to.indexOf('manual') >= 0) {
    return false;
  }
  state.currentSessionsToInitiate['*'] = msg['to'];
  _saveToStorage('currentSessionsToInitiate', state.currentSessionsToInitiate);
  notifyClient();
  freedom.emit('state-change', [{op: 'add', path: '/currentSessionsToInitiate/*', value: contact}]);
}

// Instance ID (+ more) Synchronization I/O

function _buildInstancePayload(msg, clientId) {
  // Look up permissions for the clientId.
  var u, trust = null;
  for (u in state.roster) {
    if (state.roster[u].clients[clientId] !== undefined) {
      trust = state.roster[u].clients[clientId].trust;
    }
  }

  return JSON.stringify({
    message: msg,
    data: {
      instanceId: '' + state.me.instanceId,
      description: '' + state.me.description,
      keyHash: '' + state.me.keyHash,
      trust: (trust? trust : { asProxy: Trust.NO, asClient: Trust.NO })
    }});
}

function _sendNotifyInstance(user, client) {
  if (client['network'] === undefined || (client.network != 'loopback' && client.network != 'manual')) {
    var msg = _buildInstancePayload('notify-instance', user);
    log.debug('identity.sendMessage(' + user + ', ' + msg + ')');
    identity.sendMessage(user, msg);  // user is a clientId.
  }
}

/**
 * Primary handler for synchronizing Instance data. Updates an instance-client
 * mapping, and emit state-changes to the UI.
 */
function _handleNotifyInstanceReceived(msg, clientId) {
  log.debug('_handleNotifyInstanceReceived(from: ' + msg.fromUserId + ')');
  var instanceId = msg.data.instanceId;
  var description = msg.data.description;
  var keyHash = msg.data.keyHash;
  var userId = msg.fromUserId;
  var clientId = msg.fromClientId;
  var user = state.roster[userId];
  if (!user) {
    log.error("user does not exist in roster for instanceId: " + instanceId);
    return false;
  }
  var client = user.clients[clientId];
  if (!client) {
    log.error('client does not exist! User: ' + user);
    return false;
  }
  // TODO(uzimizu): Actually make this check work.
  _validateKeyHash(keyHash);

  var instanceOp = 'replace';  // JSONpatch operation to send through freedom.
  var instance = state.instances[instanceId];
  if (!instance) {
    instance = _prepareNewInstance(instanceId, description, keyHash);
    instanceOp = 'add';
  }

  var oldClientId = instance.clientId;
  // Delete old clients for same instanceId if necessary.
  if (oldClientId && clientId != oldClientId) {
    log.debug('_handleNotifyInstanceReceived: deleting old clientID: ',
              oldClientId);
    delete _clients[oldClientId];
    delete user.clients[oldClientId];
  }

  log.debug('_handleRequestInstanceIdResponseReceived: saving instance ' + JSON.stringify(instance));

  client.instanceId = instanceId;  // Synchronize latest IDs.
  instance.clientId = clientId;

  // Save to local storage.
  _saveInstance(instanceId, userId);
  _saveInstanceId(instanceId);

  freedom.emit('state-change', [{  // Tell extension about updated state.
      op: 'replace',    // User data.
      path: '/roster/' + msg.fromUserId,
      value: state.roster[msg.fromUserId]
    }, {
      op: instanceOp,   // Instance data.
      path: '/instances/' + instanceId,
      value: instance
    }
  ]);
  return true;
}

/**
 * When a new instanceId is received, prepare a new entry for the Instance
 * Table.
 */
function _prepareNewInstance(instanceId, description, keyHash) {
  var instance = DEFAULT_INSTANCE;
  instance.instanceId = instanceId;
  instance.description = description;
  instance.keyHash = keyHash;
  state.instances[instanceId] = instance;
  log.debug('Prepared NEW Instance: ', instance);
  return instance;
}

function _validateKeyHash(keyHash) {
  console.error('Not Implemented.');
  return true;
}
