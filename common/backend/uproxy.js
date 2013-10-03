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
console.log('Uproxy backend: ' + self.location.href);  // Webworker uri.

var DEBUG = true; // XXX get this from somewhere else
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
  YES: 'yes'
};
var TrustType = {
  PROXY: 'asProxy',
  CLIENT: 'asClient'
};

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

// Mapping functions
function instanceToClient(instanceId) {
  // TODO: client = state[StateEntries.INSTANCES][
  var instance = state.instances[instanceId];
  if (!instance) {
    return null;
  }
  return instance.currentClient;
}

function clientToInstance(clientId) {
  // TODO:
  return null
}

// Mock data for what may live in local storage. (note: values will be strings
// too, via JSON interpretation)
var LOCAL_STORAGE_EXAMPLE = {
  "me": { "description": "l's Laptop",
          "instanceId": "mememmemememsdhodafslkffdaslkjfds",
        },
  "options": {
    "allowNonRoutableAddresses": false,
    "stunServers": ["stunServer1", "stunServer2"],
    "turnServers": ["turnServer1", "turnServer2"]
  },
  // Note invariant: for each instanceIds[X] there should be an entry:
  // "instance/X": { ... } which holds out local stored knowledge about that
  // instance id.
  "instanceIds": [
    "ssssssssshjafdshjadskfjlkasfs",
    "rrrrrrhjfhjfjnbmnsbfdbmnfsdambnfdsmn",
    "qqqqjksdklflsdjkljkfdsa"
  ],
  "instance/ssssssssshjafdshjadskfjlkasfs": {
    "name": "S",
    "description": "S's home desktop",
    "annotation": "Cool S who has high bandwidth",
    "instanceId": "ssssssssshjafdshjadskfjlkasfs",
    "userId": "s@gmail.com",
    "network": "google",
    "keyhash" : "HASHssssjklsfjkldfslkfljkdfsklas",
    "permissions":
      { "proxy": "yes", // "no" | "requested" | "yes"
        "client": "no" // "no" | "requested" | "yes"
      }
    // "status" {
       // "activeProxy": boolean
       // "activeClient": boolean
    // }
  },
  "instance/r@fmail.com": {
    "name": "R",
    "description": "R's laptop",
    "annotation": "R is who is repressed",
    "instanceId": "rrrrrrhjfhjfjnbmnsbfdbmnfsdambnfdsmn",
    "userId": "r@facebook.com",
    "network": "facebook",
    "keyhash" : "HASHrrrjklsfjkldfslkfljkdfsklas",
    "permissions":
      { "proxy": "no",
        "client": "yes"
      }
  },
  "instance/qqqqjksdklflsdjkljkfdsa": {
    "name": "S",
    "description": "S's laptop",
    "annotation": "S who is on qq",
    "instanceId": "qqqqjksdklflsdjkljkfdsa",
    "userId": "s@qq",
    "network": "manual",
    "keyhash" : "HASHqqqqqjklsfjkldfslkfljkdfsklas",
    "permissions":
      { "proxy": "no",
        "client": "no"
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

function _loadStateFromStorage(state) {
  var key;
  var instanceIds = [];

  // Set the saves |me| state and |options|.
  key = StateEntries.ME;
  _loadFromStorage(key, function(v){ state[key] = v; }, RESET_STATE[key]);
  key = StateEntries.OPTIONS;
  _loadFromStorage(key, function(v){ state[key] = v; }, RESET_STATE[key]);

  // Set the state |instances| from the local storage entries.
  var instancesTable = {};
  state[StateEntries.INSTANCES] = instancesTable;
  key = StateEntries.INSTANCEIDS;
  _loadFromStorage(key, function(instanceIds) {
    console.log("instanceIds:", instanceIds);
    for (var i = 0; i < instanceIds.length ; i++) {
      var key = instanceIds[i];
      _loadFromStorage(key, function(v) {
        if(v === null) {
          console.error("_loadStateFromStorage: undefined key:", key);
        } else {
          instancesTable[key] = v;
        }},
      null);
    }
  }, []);

 // TODO: remove these and propergate changes.
 state.allowGiveTo = {};
 state.pendingGiveTo = {};
 state.canGetFrom = {};
 state.pendingGetFrom = {};
 state.currentSessionsToInitiate = {};
 state.currentSessionsToRelay = {};
}

function _saveStateToStorage() {
  // TODO
  console.error("Not yet implemented");
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
  /**
  _loginInit(function() {
    identity.logout(null).done(function() {
      setTimeout(_loginInit, 3000);
    });
  });
  **/
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

  // Update local user's online status.
  identity.on('onStatus', function(data) {
    if (data.userId) {
      state.identityStatus[data.network] = data;
      freedom.emit('state-change', [{
          op: 'add',
          path: '/identityStatus/' + data.network,
          value: data
      }]);
    }
    if (data.userId && !state.me[data.userId]) {
      state.me[data.userId] = { userId: data.userId };
    }
  });

  identity.on('onChange', function(data) {
    //If my card changed
    if (data.userId && state.me[data.userId]) {
      state.me[data.userId] = data;
      freedom.emit('state-change', [{op: 'add', path: '/me/'+data.userId, value: data}]);
      notifyClient();
      notifyServer();
    } else { //must be a buddy
      state.roster[data.userId] = data;
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
  });

  freedom.on('send-message', function (msg) {
    identity.sendMessage(msg.to, msg.message);
    _handleMessage(msg, true);  // beingSent = true
  });

  freedom.on('ignore', function (userId) {
    // delete state.pendingGiveTo[userId];
    // TODO: fix.
    // _saveToStorage('pendingGiveTo', state.pendingGiveTo);
    // freedom.emit('state-change', [
      // {op: 'remove', path: '/pendingGiveTo/'+userId}
    // ]);
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

// Trust mutation.
var TrustOp = {
  'allow': Trust.YES,
  'request-access': Trust.REQUESTED,
  'deny': Trust.NO
}

/**
 * Bi-directional message handler.
 *
 * @isSent - True if message is being sent. False if received.
 */
function _handleMessage(msg, beingSent) {
  log.debug('Handling ' + (beingSent ? 'sent' : 'received') + ' message:', msg);
  // Check if this is a trust modification.
  var trustValue = TrustOp[msg.message];  // NO, REQUESTED, or YES
  if (trustValue) {
    // Access request and Grants go in opposite directions.
    var asProxy = 'allow' == msg.message ? !beingSent : beingSent;
    _updateTrust(msg.to, asProxy, trustValue);
    // TODO freedom emit this stuff and save to storage
    return true;
  }

  // Check if it's a proxy connection message.
  log.debug('Dealing with a proxy connection?!?');
  var handler = null;
  if (!handler) {
    log.error('No handler for sent message: ', msg);
    return false;
  }
}

function _updateTrust(clientId, asProxy, trustValue) {
  var instance = clientToInstance(clientId);
  if (!instance) {
    log.debug('Could not find instance corresponding to client: ' + clientId);
    return false;
  }
  var trust = asProxy? instance.trust.asProxy : instance.trust.asClient;
  log.debug('Modifying trust value: ', instance, trust);
  trust = trustValue;
  // TODO freedom emit? and local storage?
  return true;
}


var _msgReceivedHandlers = {
  'start-proxying': _handleProxyStartReceived,
  'connection-setup': _handleConnectionSetupReceived,
  'connection-setup-response': _handleConnectionSetupResponseReceived
};

var _msgSentHandlers = {
  'start-proxying': _handleStartProxyingSent
};

function _handleProxyStartReceived(msg, contact) {
  // TODO: Access Check on if it's allowed.
  state.currentSessionsToRelay[msg['fromClientId']] = msg['fromClientId'];
  _saveToStorage('currentSessionsToRelay', state.currentSessionsToRelay);
  notifyServer();
  freedom.emit('state-change', [{op: 'add', path: '/currentSessionsToRelay/' + msg['fromClientId'], value: contact}]);
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

function _handleConnectionSetupResponseReceived(msg, contact) {
  msg.data.from = msg['fromClientId'];
  client.emit('toClient', msg.data);
}

// Handle sending -----------------------------------------------------------

function _handleStartProxyingSent(msg, contact) {
  //TODO replace with better handling of manual identity
  if (msg.to.indexOf('manual') >= 0) {
    return false;
  }
  state.currentSessionsToInitiate['*'] = msg['to'];
  _saveToStorage('currentSessionsToInitiate', state.currentSessionsToInitiate);
  notifyClient();
  freedom.emit('state-change', [{op: 'add', path: '/currentSessionsToInitiate/*', value: contact}]);
}
