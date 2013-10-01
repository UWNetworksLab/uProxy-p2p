'use strict';

var DEBUG = true; // XXX get this from somewhere else
console.log('Uproxy backend');

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

// Initial empty state
var RESET_STATE = {
  "_debug": DEBUG,
  "_msgLog": [],

  "me": {},
  "roster": {},

  "options": {
    "allowNonRoutableAddresses": false,
    "stunServers": ["stunServer1", "stunServer2"],
    "turnServers": ["turnServer1", "turnServer2"]
  }
};
var state = cloneDeep(RESET_STATE);

var LOCAL_STORAGE_ENTRIES = {
  // These are default dummy initial values
  "me": { "description": "l's Laptop", }
  "options": {
    "allowNonRoutableAddresses": false,
    "stunServers": ["stunServer1", "stunServer2"],
    "turnServers": ["turnServer1", "turnServer2"]
  },
  "rosterIds": [
    "s@gmail.com",
    "r@gmail.com",
    "s on qq"
  ],
  "roster/s@gmail.com": {
    "annotation": "Cool S who has high bandwidth",
    "instanceId": "ssssssssshjafdshjadskfjlkasfs",
    "permissions":
      { "proxy": "yes" // "no" | "requested" | "yes"
        "client": "no" // "no" | "requested" | "yes"
      }
    // "status" {
       // "activeProxy": boolean
       // "activeClient": boolean
    // }
  },
  "roster/r@fmail.com": {
    "annotation": "R is who is repressed",
    "instanceId": "rrrrrrhjfhjfjnbmnsbfdbmnfsdambnfdsmn",
    "permissions":
      { "proxy": "no"
        "client": "yes"
      }
  },
  "roster/s on qq": {
    "annotation": "S who is on qq",
    "instanceId": "sssssjksdklflsdjkljkfdsa",
    "permissions":
      { "proxy": "no"
        "client": "no"
      }
  }
};


storage.set(client.userId, JSON.stringify(client)).done(callback);


function _loadKeyFromStorage(key, callback, defaultIfUndefined) {
  storage.get(key).done(function (result) {
    if (isDefined(result)) {
      var parsed = JSON.parse(result);
      callback(parsed);
    } else {
      callback(defaultIfUndefined);
    }
  });
}

function _save(key, val, callback) {
  storage.set(key, JSON.stringify(val)).done(callback);
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


  LOCAL_STORAGE_ENTRIES.forEach(function (key) {
    _loadKeyFromStorage(key, function (data) { state[key] = data; },
        RESET_STATE[key]);
  });

  freedom.on('reset', function () {
    log.debug('reset');
    state = cloneDeep(RESET_STATE);
    // TODO: sign out of Google Talk
    var nkeys = LOCAL_STORAGE_ENTRIES.length, nreset = 0;
    LOCAL_STORAGE_ENTRIES.forEach(function (key) {
      _save(key, RESET_STATE[key], function () {
        log.debug('reset', key);
        if ((++nreset) === nkeys) {
          log.debug('done resetting, sending reset state');
          freedom.emit('state-change', [{op: 'replace', path: '', value: state}]);
        }
      });
    });
  });

  // Called from extension whenever the user clicks opens the extension popup.
  freedom.on('open-popup', function () {
    log.debug('open-popup');
    log.debug('state:', state);
    // Send the extension the state
    freedom.emit('state-change', [{op: 'replace', path: '', value: state}]);
  });

  identity.on('onStatus', function(data) {
    if (data.userId) {
      state.identityStatus[data.network] = data;
      freedom.emit('state-change', [{op: 'add', path: '/identityStatus/'+data.network, value: data}]);
    }
    if (data.userId && !state.me[data.userId]) {
      state.me[data.userId] = {userId: data.userId};
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
    _save('pendingGiveTo', state.pendingGiveTo);
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
    _save('options', state.options);
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
  'connection-setup-response': _handleConnectionSetupResponseReceived
};

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
  _save('canGetFrom', state.canGetFrom);
  delete state.pendingGetFrom[contact.userId];
  _save('pendingGetFrom', state.pendingGetFrom);
  freedom.emit('state-change', [
    {op: 'add', path: '/canGetFrom/'+contact.userId, value: contact},
    {op: 'remove', path: '/pendingGetFrom/'+contact.userId}
  ]);
}

function _handleRequestAccessReceived(msg, contact) {
  state.pendingGiveTo[contact.userId] = contact;
  _save('pendingGiveTo', state.pendingGiveTo);
  freedom.emit('state-change', [{op: 'add', path: '/pendingGiveTo/'+contact.userId, value: contact}]);
}

function _handleProxyStartReceived(msg, contact) {
  // TODO: Access Check on if it's allowed.
  state.currentSessionsToRelay[msg['fromClientId']] = msg['fromClientId'];
  _save('currentSessionsToRelay', state.currentSessionsToRelay);
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
    _loadKeyFromStorage(verifiedCryptoKeysKey, function(verifiedCryptoKeys) {
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
  _save('allowGiveTo', state.allowGiveTo);
  delete state.pendingGiveTo[contact.userId];
  _save('pendingGiveTo', state.pendingGiveTo);
  freedom.emit('state-change', [
    {op: 'add', path: '/allowGiveTo/'+contact.userId, value: contact},
    {op: 'remove', path: '/pendingGiveTo/'+contact.userId}
  ]);
}

function _handleRequestAccessSent(msg, contact) {
  state.pendingGetFrom[contact.userId] = contact;
  _save('pendingGetFrom', state.pendingGetFrom);
  freedom.emit('state-change', [{op: 'add', path: '/pendingGetFrom/'+contact.userId, value: contact}]);
}

function _handleStartProxyingSent(msg, contact) {
  //TODO replace with better handling of manual identity
  if (msg.to.indexOf('manual') >= 0) {
    return;
  }

  state.currentSessionsToInitiate['*'] = msg['to'];
  _save('currentSessionsToInitiate', state.currentSessionsToInitiate);
  notifyClient();
  freedom.emit('state-change', [{op: 'add', path: '/currentSessionsToInitiate/*', value: contact}]);
}

