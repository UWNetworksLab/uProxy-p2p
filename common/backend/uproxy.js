'use strict';

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

//XXX: Makes chrome debugging saner, not needed otherwise.
var window = {};

// enum of state ids that we need to worry about.
var StateEntries = {
  ME: "me",
  OPTIONS: "options",
  INSTANCEIDS: "instanceIds", // only exists for local storage state.
  INSTANCES: "instances",   // only exists for in-memory state.
}

// Initial empty state
var RESET_STATE = {
  // debugging stuff
  "_debug": DEBUG,  // debug state.
  "_msgLog": [],  //

  // A table from network identifier to your status on that network
  // (online/offline/idle, etc)
  "identityStatus": {},
  // Entries filled in by identity providers.
  "me": {},
  // Merged roster of contacts coming from each identity provider.
  "roster": {},

  // Options coming from local storage and setable by the options page.
  "options": {
    "allowNonRoutableAddresses": false,
    "stunServers": ["stunServer1", "stunServer2"],
    "turnServers": ["turnServer1", "turnServer2"]
  }
};
// Initial state is set from RESET_STATE.
var state = cloneDeep(RESET_STATE);

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
    "annotation": "Cool S who has high bandwidth",
    "instanceId": "ssssssssshjafdshjadskfjlkasfs",
    "userId": "s@gmail.com",
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
    "annotation": "R is who is repressed",
    "instanceId": "rrrrrrhjfhjfjnbmnsbfdbmnfsdambnfdsmn",
    "userId": "r@fmail.com",
    "keyhash" : "HASHrrrjklsfjkldfslkfljkdfsklas",
    "permissions":
      { "proxy": "no",
        "client": "yes"
      }
  },
  "instance/qqqqjksdklflsdjkljkfdsa": {
    "annotation": "S who is on qq",
    "instanceId": "qqqqjksdklflsdjkljkfdsa",
    "userId": "s@qq",
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
  _loadFromStorage(key, function(instanceIds){
      console.log("instanceIds:", instanceIds);
      for(var i = 0; i < instanceIds.length; i++) {
        var key = instanceIds[i];
        _loadFromStorage(key,
            function(v){
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
  log.debug('_loadStateFromStorage: saving state: ' + JSON.stringify(state));
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

// Called once when uproxy.js is loaded.
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

  freedom.on('reset', function () {
    log.debug('reset');
    // TODO: sign out of Google Talk and other networks.
    state = cloneDeep(RESET_STATE);
    _loadStateFromStorage(state);
  });

  // Called from extension whenever the user clicks opens the extension popup.
  freedom.on('open-popup', function () {
    log.debug('open-popup');
    log.debug('state:', state);
    // Send the extension the state
    freedom.emit('state-change', [{op: 'replace', path: '', value: state}]);
  });

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
      _updateInstanceIdsOnChange(state.roster[data.userId], data);
      state.roster[data.userId] = data;
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
    _handleMessageReceived(msg);
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
    _handleMessageSent(msg);
  });

  freedom.on('ignore', function (userId) {
    delete state.pendingGiveTo[userId];
    // TODO: fix.
    _saveToStorage('pendingGiveTo', state.pendingGiveTo);
    freedom.emit('state-change', [
      {op: 'remove', path: '/pendingGiveTo/'+userId}
    ]);
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

var _msgReceivedHandlers = {
  'allow': _handleAllowReceived,
  'request-access': _handleRequestAccessReceived,
  'start-proxying': _handleProxyStartReceived,
  'connection-setup': _handleConnectionSetupReceived,
  'connection-setup-response': _handleConnectionSetupResponseReceived,
  'request-instance-id' : _handleRequestInstanceIdReceived,
  'request-instance-id-response' : _handleRequestInstanceIdResponseReceived
};

// Look for a !messageable->messageable transition, and dispatch a
// query if needed.
function _updateInstanceIdsOnChange(prior, current) {
  var should_dump = false;
  for (var client in current.clients) {
    var cur = current.clients[client];
    var prev = prior? prior.clients[client] : null;
    if (cur.network == 'google') {
      should_dump = true;
    }
    if (cur.status == 'messageable' && (!prev || prev.status != 'messageable')) {
      _dispatchInstanceIdQuery(current.userId, cur);
    }
  }
  if (should_dump) {
    log.debug('_updateInstanceIdsOnChange(  prior="' + JSON.stringify(prior) + '",');
    log.debug('_updateInstanceIdsOnChange   current="' + JSON.stringify(current) + '")');
  }
}

function _dispatchInstanceIdQuery(user, client) {
  log.debug('_dispatchInstanceIdQuery(' + user + ', ' + JSON.stringify(client) + ')');
  if (client.network != 'loopback' && client.network != 'manual') {
    log.debug('_dispatchInstanceIdQuery:  identity.sendMessage(' +
              client.clientId + ', {message: request-instance-id})')
    identity.sendMessage(client.clientId,
                         JSON.stringify({ message: 'request-instance-id' }));
  }
}

function _handleMessageReceived(msg) {
  var handler = _msgReceivedHandlers[msg.message];
  if (!handler) {
    log.error('No handler for received message:', msg);
  } else {
    log.debug('Handling received message:', msg);
    var contact = state.roster[msg.fromUserId];
    if (!contact) {
      log.debug('userId', msg.fromUserId, 'not on roster, ignoring');
    } else {
      handler(msg, contact);
    }
  }
}

function _handleAllowReceived(msg, contact) {
  state.canGetFrom[contact.userId] = contact;
  // TODO: fix.
  _saveToStorage('canGetFrom', state.canGetFrom);
  delete state.pendingGetFrom[contact.userId];
  // TODO: fix.
  _saveToStorage('pendingGetFrom', state.pendingGetFrom);
  freedom.emit('state-change', [
    {op: 'add', path: '/canGetFrom/'+contact.userId, value: contact},
    {op: 'remove', path: '/pendingGetFrom/'+contact.userId}
  ]);
}

function _handleRequestAccessReceived(msg, contact) {
  state.pendingGiveTo[contact.userId] = contact;
  // TODO: fix.
  _saveToStorage('pendingGiveTo', state.pendingGiveTo);
  freedom.emit('state-change', [{op: 'add', path: '/pendingGiveTo/'+contact.userId, value: contact}]);
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

function _handleConnectionSetupResponseReceived(msg, contact) {
  msg.data.from = msg['fromClientId'];
  client.emit('toClient', msg.data);
}

var _msgSentHandlers = {
  'allow': _handleAllowSent,
  'request-access': _handleRequestAccessSent,
  'start-proxying': _handleStartProxyingSent
};

function _handleMessageSent(msg) {
  var handler = _msgSentHandlers[msg.message];
  if (!handler) {
    log.error('No handler for sent message:', msg);
  } else {
    log.debug('Handling sent message:', msg);
    var contact = state.roster[msg.toUserId || msg.to];
    if (!contact) {
      log.debug('userId', msg.to, 'not on roster, ignoring');
    } else {
      handler(msg, contact);
    }
  }
}

function _handleAllowSent(msg, contact) {
  state.allowGiveTo[contact.userId] = contact;
  _saveToStorage('allowGiveTo', state.allowGiveTo);
  delete state.pendingGiveTo[contact.userId];
  _saveToStorage('pendingGiveTo', state.pendingGiveTo);
  freedom.emit('state-change', [
    {op: 'add', path: '/allowGiveTo/'+contact.userId, value: contact},
    {op: 'remove', path: '/pendingGiveTo/'+contact.userId}
  ]);
}

function _handleRequestAccessSent(msg, contact) {
  state.pendingGetFrom[contact.userId] = contact;
  _saveToStorage('pendingGetFrom', state.pendingGetFrom);
  freedom.emit('state-change', [{op: 'add', path: '/pendingGetFrom/'+contact.userId, value: contact}]);
}

function _handleStartProxyingSent(msg, contact) {
  //TODO replace with better handling of manual identity
  if (msg.to.indexOf('manual') >= 0) {
    return;
  }

  state.currentSessionsToInitiate['*'] = msg['to'];
  _saveToStorage('currentSessionsToInitiate', state.currentSessionsToInitiate);
  notifyClient();
  freedom.emit('state-change', [{op: 'add', path: '/currentSessionsToInitiate/*', value: contact}]);
}

function _handleRequestInstanceIdReceived(msg, contact) {
  // Ignore |msg|, just send back our instanceId to |contact|
  // TODO(mollyling): consider rate-limiting responses, in case the
  // other side's flaking out.
  log.debug('_handleRequestInstanceIdReceived(' + JSON.stringify(msg) + ', ' + JSON.stringify(contact));

}
function _handleRequestInstanceIdResponseReceived(msg, contact) {
  // Update |state| with the instance ID, and emit a state-change
  // notification to tell the UI what's up.
  log.debug('_handleRequestInstanceIdResponseReceived(' + JSON.stringify(msg) + ', ' +
      JSON.stringify(contact));
}
