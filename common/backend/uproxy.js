/**
 * uproxy.js
 *
 * This is the primary backend script. It maintains in-memory state,
 * checkpoints information to local storage, and synchronizes state with the
 * front-end.
 *
 * In-memory state includes:
 *  - Roster, which is a list of contacts, always synced with XMPP friend lists.
 *  - Instances, which is a list of active UProxy installs.
 */
'use strict';

// JS-Hint/JS-lint
/* global self, makeLogger, freedom, cloneDeep, isDefined, nouns, adjectives,
   Trust, freedom: false, UProxyState: false, console: false, DEBUG: false,
   ProxyState: false, store, _localTestProxying */

// The channel to speak to the UI part of uproxy. The UI is running from the
// privileged part of freedom, so we can just set this to be freedom.
var bgAppPageChannel = freedom;

// Channels with module interface to speak to the various providers.

// Identity is a module that speaks to chat networks and does some message
// passing to manage contacts privilages and initiate proxying.
var identity = freedom.identity();

// Client is used to manage a peer connection to a contact that will proxy our
// connection. This module listens on a localhost port and forwards requests
// through the peer connection.
var client = freedom.uproxyclient();

// Server allows us to act as a proxy for our contacts.
// Server module; listens for peer connections and proxies their requests
// through the peer connection.
var server = freedom.uproxyserver();

// --------------------------------------------------------------------------
//  General UI interaction
// --------------------------------------------------------------------------
function sendFullStateToUI() {
  console.log("sending sendFullStateToUI state-change.");
  bgAppPageChannel.emit('state-change', [{op: 'replace', path: '',
      value: store.state}]);
}

// Define freedom bindings.
bgAppPageChannel.on('reset', function () { reset(); });

// Logs out of networks and resets data.
function reset() {
  console.log('reset');
  identity.logout(null, null);
  store.reset(function() {
    // TODO: refactor so this isn't needed.
    console.log("reset state to: ", store.state);
    sendFullStateToUI();
  });
}

// Called from extension whenever the user clicks opens the extension popup.
// The intent is to reset its model - but this may or may not always be
// necessary. Improvements to come.
bgAppPageChannel.on('ui-ready', function () {
  console.log('ui-ready');
  console.log('state:', store.state);
  // Send the extension the full state.
  sendFullStateToUI();
});

bgAppPageChannel.on('login', function(network) {
  _Login(network);
});

bgAppPageChannel.on('logout', function(network) {
  identity.logout(null, network);
  // TODO: only remove clients from the network we are logging out of.
  // Clear the clientsToInstance table.
  store.state.clientToInstance = {};
  store.state.me.networkDefaults[network].autoconnect = false;

});

bgAppPageChannel.on('invite-friend', function (userId) {
  identity.sendMessage(userId, "Join UProxy!");
});

bgAppPageChannel.on('echo', function (msg) {
  // store.state._msgLog.push(msg);
  // bgAppPageChannel.emit('state-change', [{op: 'add', path: '/_msgLog/-', value: msg}]);
});

bgAppPageChannel.on('change-option', function (data) {
  store.state.options[data.key] = data.value;
  store.saveOptionsToStorage();
  console.log('saved options ' + JSON.stringify(store.state.options));
  bgAppPageChannel.emit('state-change', [{op: 'replace', path: '/options/'+data.key, value: data.value}]);
  // TODO: Handle changes that might affect proxying
});

// Updating our own UProxy instance's description.
bgAppPageChannel.on('update-description', function (data) {
  store.state.me.description = data;  // UI side already up-to-date.

  // TODO(uzimizu): save to storage
  var payload = JSON.stringify({
    type: 'update-description',
    instanceId: '' + store.state.me.instanceId,
    description: '' + store.state.me.description
  });

  // Send the new description to ALL currently online friend instances.
  for (var instanceId in store.state.instances) {
    var clientId = store.state.instanceToClient[instanceId];
    if (clientId) identity.sendMessage(clientId, payload);
  }
});

// Updating our own UProxy instance's description.
bgAppPageChannel.on('notification-seen', function (userId) {
  var user = store.state.roster[userId];
  if (!user) {
    console.error('User ' + userId + ' does not exist!');
    return false;
  }
  // user.hasNotification = false;
  // Go through clients, remove notification flag from any uproxy instance.
  for (var clientId in user.clients) {
    var instanceId = store.state.clientToInstance[clientId];
    if (instanceId) {
      _removeNotification(instanceId);
    }
  }
  // Don't need to re-sync with UI - expect UI to have done the change.
});

// --------------------------------------------------------------------------
//  Proxying
// --------------------------------------------------------------------------
// TODO: say not if we havn't given them permission :)
bgAppPageChannel.on('start-using-peer-as-proxy-server',
    function(peerInstanceId) {
  startUsingPeerAsProxyServer(peerInstanceId);
});

bgAppPageChannel.on('stop-proxying', function(peerInstanceId) {
  stopUsingPeerAsProxyServer(peerInstanceId);
});

// peerId is a client ID.
client.on('sendSignalToPeer', function(data) {
    console.log('client(sendSignalToPeer):' + JSON.stringify(data) +
                ', sending to client: ' + data.peerId + ", which should map to instance: " +
                    store.state.clientToInstance[data.peerId]);
  // TODO: don't use 'message' as a field in a message! that's confusing!
  // data.peerId is an instance ID.  convert.
  identity.sendMessage(data.peerId,
      JSON.stringify({type: 'peerconnection-client', data: data.data}));
});

server.on('sendSignalToPeer', function(data) {
  console.log('server(sendSignalToPeer):' + JSON.stringify(data) +
                ', sending to client: ' + data.peerId);
  identity.sendMessage(data.peerId,
      JSON.stringify({type: 'peerconnection-server', data: data.data}));
});

// Begin SDP negotiations with peer. Assumes |peer| exists.
function startUsingPeerAsProxyServer(peerInstanceId) {
  var instance = store.state.instances[peerInstanceId];
  if (!instance) {
    console.error('Instance ' + peerInstanceId + ' does not exist for proxying.');
    return false;
  }
  if (Trust.YES != store.state.instances[peerInstanceId].trust.asProxy) {
    console.log('Lacking permission to proxy through ' + peerInstanceId);
    return false;
  }
  // TODO: Cleanly disable any previous proxying session.
  instance.status.proxy = ProxyState.RUNNING;
  // _SyncUI('/instances/' + peerInstanceId, instance);
  _syncInstanceUI(instance, 'status');

  // TODO: sync properly between the extension and the app on proxy settings
  // rather than this cooincidentally the same data.
  client.emit("start",
              {'host': '127.0.0.1', 'port': 9999,
               // peerId of the peer being routed to.
               'peerId': store.state.instanceToClient[peerInstanceId]});

  // This is a temporary hack which makes the other end aware of your proxying.
  // TODO(uzimizu): Remove this once proxying is happening *for real*.
  identity.sendMessage(
      store.state.instanceToClient[peerInstanceId],
      JSON.stringify({
          type: 'newly-active-client',
          instanceId: store.state.me.instanceId
      }));
}

function stopUsingPeerAsProxyServer(peerInstanceId) {
  var instance = store.state.instances[peerInstanceId];
  if (!instance) {
    console.error('Instance ' + peerInstanceId + ' does not exist!');
    return false;
  }
  // TODO: Handle revoked permissions notifications.
  // [{op: 'replace', path: '/me/peerAsProxy', value: ''}]);

  client.emit("stop");
  instance.status.proxy = ProxyState.OFF;
  _syncInstanceUI(instance, 'status');

  // TODO: this is also a temporary hack.
  identity.sendMessage(
      store.state.instanceToClient[peerInstanceId],
      JSON.stringify({
          type: 'newly-inactive-client',
          instanceId: store.state.me.instanceId
      }));
}

// peerconnection-client -- sent from client on other side.
function receiveSignalFromClientPeer(msg) {
  console.log('receiveSignalFromClientPeer: ' + JSON.stringify(msg));
  // sanitize from the identity service
  server.emit('handleSignalFromPeer',
      {peerId: msg.fromClientId, data: msg.data.data});
}

// peerconnection-server -- sent from server on other side.
function receiveSignalFromServerPeer(msg) {
  console.log('receiveSignalFromServerPeer: ' + JSON.stringify(msg));
  // sanitize from the identity service
  client.emit('handleSignalFromPeer',
      {peerId: msg.fromClientId, data: msg.data.data});
}

// TODO(uzimizu): This is a HACK!
function handleNewlyActiveClient(msg) {
  var instanceId = msg.data.instanceId;
  var instance = store.state.instances[instanceId];
  if (!instance) {
    console.error('Cannot be proxy for nonexistent instance.');
    return;
  }
  console.log('PROXYING FOR CLIENT INSTANCE: ' + instanceId);
  // state.me.instancePeer
  instance.status.client = ProxyState.RUNNING;
  _syncInstanceUI(instance, 'status');
}

function handleInactiveClient(msg) {
  var instanceId = msg.data.instanceId;
  var instance = store.state.instances[instanceId];
  if (!instance) {
    console.error('Cannot be proxy for nonexistent instance.');
    return;
  }
  instance.status.client = ProxyState.OFF;
  _syncInstanceUI(instance, 'status');
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

// The user clicked on something to change the trust w.r.t. another user.
// Update trust level for an instance, and maybe send a messahe to the client
// for the instance that we changed.
bgAppPageChannel.on('instance-trust-change', function (data) {
  var iId = data.instanceId;
  // Set trust level locally, then notify through XMPP if possible.
  _updateTrust(data.instanceId, data.action, false);  // received = false
  var clientId = store.state.instanceToClient[iId];
  if (!clientId) {
    console.log('Warning! Cannot change trust level because client ID does not ' +
              'exist for instance ' + iId + ' - they are probably offline.');
    return false;
  }
  identity.sendMessage(clientId, JSON.stringify({type: data.action}));
  return true;
});

// Update trust state for a particular instance. Emits change to UI.
// |instanceId| - instance to change the trust levels upon.
// |action| - Trust action to execute.
// |received| - boolean of source of this action.
function _updateTrust(instanceId, action, received) {
  received = received || false;
  var asProxy = ['allow', 'deny', 'offer'].indexOf(action) < 0 ?
      !received : received;
  var trustValue = TrustOp[action];
  var instance = store.state.instances[instanceId];
  if (!instance) {
    console.error('Cannot find instance ' + instanceId + ' for a trust change!');
    return false;
  }
  if (asProxy) {
    instance.trust.asProxy = trustValue;
  } else {
    instance.trust.asClient = trustValue;
  }
  store.saveInstance(instanceId);
  _syncInstanceUI(instance, 'trust');
  console.log('Instance trust changed. ' + JSON.stringify(instance.trust));
  return true;
}

//
function receiveTrustMessage(msgInfo) {
  var msgType = msgInfo.data.type;
  var clientId = msgInfo.fromClientId;
  var instanceId = store.state.clientToInstance[clientId];
  if (!instanceId) {
    // TODO(uzimizu): Attach instanceId to the message and verify.
    console.error('Could not find instance for the trust modification!');
    return;
  }
  _updateTrust(instanceId, msgType, true);  // received = true
  _addNotification(instanceId);
}

// --------------------------------------------------------------------------
//  Messages
// --------------------------------------------------------------------------
// Update local user's online status (away, busy, etc.).
identity.on('onStatus', function(data) {
  console.log('onStatus: data:' + JSON.stringify(data));
  if (data.userId) { // userId is only specified when connecting or online.
    store.state.identityStatus[data.network] = data;
    bgAppPageChannel.emit('state-change',
        [{op: 'add', path: '/identityStatus/' + data.network, value: data}]);
    if (!store.state.me.identities[data.userId]) {
      store.state.me.identities[data.userId] = {userId: data.userId};
    }
  }
});

// Called when a contact (or ourselves) changes state, whether online or
// description.
// |data| is guarenteed to have userId.
identity.on('onChange', function(data) {
  try {
    if (store.state.me.identities[data.userId]) {
      // My card changed.
      store.state.me.identities[data.userId] = data;
      _SyncUI('/me/identities/' + data.userId, data, 'add');
      // TODO: Handle changes that might affect proxying
    } else {
      updateUser(data);  // Not myself.
    }
  } catch (e) {
    console.log('Failure in onChange handler.  store.state.me = ' + JSON.stringify(store.state.me));
    console.log(e.stack);
  }
});

var _msgReceivedHandlers = {
    'allow': receiveTrustMessage,
    'offer': receiveTrustMessage,
    'deny': receiveTrustMessage,
    'request-access': receiveTrustMessage,
    'cancel-request': receiveTrustMessage,
    'accept-offer': receiveTrustMessage,
    'decline-offer': receiveTrustMessage,
    'notify-instance': receiveInstance,
    'notify-consent': receiveConsent,
    'update-description': receiveUpdateDescription,
    'peerconnection-server' : receiveSignalFromServerPeer,
    'peerconnection-client' : receiveSignalFromClientPeer,
    'newly-active-client' : handleNewlyActiveClient,
    'newly-inactive-client' : handleInactiveClient
};

//
identity.on('onMessage', function (msgInfo) {
  console.log('identity.on(onMessage): ' + JSON.stringify(msgInfo));
  // Replace the JSON str with actual data attributes, then flatten.
  msgInfo.messageText = msgInfo.message;
  delete msgInfo.message;
  try {
    msgInfo.data = JSON.parse(msgInfo.messageText);
  } catch(e) {
    console.error("Message was not JSON");
    return;
  }
  // Call the relevant handler.
  var msgType = msgInfo.data.type;
  if (!(msgType in _msgReceivedHandlers)) {
    console.error('No handler for message type: ' +
        JSON.stringify(msgInfo.data) + "; typeof: " + (typeof msgInfo.data));
    return;
  }
  _msgReceivedHandlers[msgType](msgInfo);
});


// Update data for a user, typically when new client data shows up. Notifies all
// new UProxy clients of our instance data, and preserve existing hooks. Does
// not do a complete replace - does a merge of any provided key values.
//
//  |newData| - Incoming JSON info for a single user.
function updateUser(newData) {
  // console.log('Incoming user data from XMPP: ' + JSON.stringify(newData));
  var userId = newData.userId,
      userOp = 'replace',
      existingUser = store.state.roster[userId];
  if (!existingUser) {
    store.state.roster[userId] = newData;
    userOp = 'add';
  }
  var user = store.state.roster[userId];
  var instance = store.instanceOfUserId(userId);
  var onGoogle = false,   // Flag updates..
      onFB = false,
      online = false,
      canUProxy = false;
  user.name = newData.name;
  user.clients = newData.clients;
  user.imageData = newData.imageData;

  for (var clientId in user.clients) {
    var client = user.clients[clientId];
    if ('offline' == client.status) {  // Delete offline clients
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
  bgAppPageChannel.emit('state-change', [{
      op: userOp,
      path: '/roster/' + userId,
      value: user
  }]);
}

// TODO(uzimizu): Figure out best way to request new users to install UProxy if
// they don't have any uproxy clients.

// Examine |client| and synchronize instance data if it's a new UProxy client.
// Returns true if |client| is a valid uproxy client.
function _checkUProxyClientSynchronization(client) {
  if (!store.isMessageableUproxyClient(client)) {
    return false;
  }
  var clientId = client.clientId;
  var clientIsNew = !(clientId in store.state.clientToInstance);

  if (clientIsNew) {
    console.log('Aware of new UProxy client. Sending instance data.' +
        JSON.stringify(client));
    // Set the instance mapping to null as opposed to undefined, to indicate
    // that we know the client is pending its corresponding instance data.
    store.state.clientToInstance[clientId] = null;
    sendInstance(client);
  }
  return true;
}

function _getMyId() {
  for (var id in store.state.me.identities) {
    return id;
  }
}

// Should only be called after we have received an onChange event with our own
// details.
function makeMyInstanceMessage() {
  var firstIdentity = store.state.me.identities[_getMyId()];
  return JSON.stringify({
    type: 'notify-instance',
    instanceId:  '' + store.state.me.instanceId,
    description: '' + store.state.me.description,
    keyHash:     '' + store.state.me.keyHash,
    rosterInfo: {
      userId:  firstIdentity.userId,
      name:    firstIdentity.name,
      network: firstIdentity.network,
      url:     firstIdentity.url
    }
  });
}

// Send a notification about my instance data to a particular clientId.
// Assumes |client| corresponds to a valid UProxy instance, but does not assume
// that we've received the other side's Instance data yet.
function sendInstance(client) {
  var instancePayload = makeMyInstanceMessage();
  console.log('sendInstance: ' + JSON.stringify(instancePayload) +
              ' to ' + JSON.stringify(client));
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
  console.log('receiveInstance(from: ' + msg.fromUserId + ')');
  var instanceId  = msg.data.instanceId;
  var userId      = msg.fromUserId;
  var clientId    = msg.fromClientId;
  var instanceOp  = (instanceId in store.state.instances) ? 'replace' : 'add';

  // Update the local instance information.
  store.syncInstanceFromInstanceMessage(userId, clientId, msg.data);
  store.saveInstance(instanceId);

  // Intended JSONpatch operation.
  // If we've had relationships to this instance, send them our consent bits.
  if (instanceOp == 'replace') {
    sendConsent(store.state.instances[instanceId]);
  }

  // Update UI's view of instances and mapping.
  // TODO: This can probably be made smaller.
  _syncInstanceUI(store.state.instances[instanceId]);
  bgAppPageChannel.emit('state-change', [
    { op: 'replace', path: '/clientToInstance',
      value: store.state.clientToInstance },
    { op: 'replace', path: '/instanceToClient',
      value: store.state.instanceToClient }
  ]);
  return true;
}

// Send consent bits to re-synchronize consent with remote |instance|.
// This happens *after* receiving an instance notification for an instance which
// we already have a history with.
function sendConsent(instance) {
  console.log("sendConsent to instance: " + JSON.stringify(instance));
  var clientId = store.state.instanceToClient[instance.instanceId];
  if (!clientId) {
    console.error('Instance ' + instance.instanceId + ' missing clientId!');
    return false;
  }
  var consentPayload = JSON.stringify({
    type: 'notify-consent',
    instanceId: store.state.me.instanceId,            // Our own instanceId.
    consent: _determineConsent(instance.trust)  // My consent.
  });
  identity.sendMessage(clientId, consentPayload);
  return true;
}

// Assumes that when we receive consent there is a roster entry.
// But does not assume there is an instance entry for this user.
function receiveConsent(msg) {
  if (! (msg.fromUserId in store.state.roster)) {
    console.error("msg.fromUserId (" + msg.fromUserId +
        ") is not in the roster");
  }
  // console.log('receiveConsent(from: ' + msg.fromUserId + '): ' +
            // JSON.stringify(msg));
  var consent     = msg.data.consent,     // Their view of consent.
      instanceId  = msg.data.instanceId,  // InstanceId of the sender.
      instance    = store.state.instances[instanceId];
  if (!instance) {
    console.error('Instance for id: ' + instanceId + ' not found!');
    return false;
  }
  // Determine my own consent bits, compare with their consent and remap.
  var oldTrustAsProxy = instance.trust.asProxy;
  var oldTrustAsClient = instance.trust.asClient;
  var myConsent = _determineConsent(instance.trust);
  instance.trust.asProxy = consent.asProxy?
      (myConsent.asClient? Trust.YES : Trust.OFFERED) :
      (myConsent.asClient? Trust.REQUESTED : Trust.NO);
  instance.trust.asClient = consent.asClient?
      (myConsent.asProxy? Trust.TES : Trust.REQUESTED) :
      (myConsent.asProxy? Trust.OFFERED : Trust.NO);
  // Apply state change notification if the trust state changed.
  if (oldTrustAsProxy != instance.trust.asProxy ||
      oldTrustAsClient != instance.trust.asClient) {
    _addNotification(instanceId);
  }
  store.saveInstance(instanceId);
  _syncInstanceUI(instance, 'trust');
  return true;
}

// For each direction (e.g., I proxy for you, or you proxy for me), there
// is a logical AND of consent from both parties. If the local state for
// trusting them to be a proxy (trust.asProxy) is Yes or Requested, we
// consent to being their client. If the local state for trusting them to
// be our client is Yes or Offered, we consent to being their proxy.
function _determineConsent(trust) {
  return { asProxy:  [Trust.YES, Trust.OFFERED].indexOf(trust.asClient) >= 0,
           asClient: [Trust.YES, Trust.REQUESTED].indexOf(trust.asProxy) >= 0 };
}

function _validateKeyHash(keyHash) {
  console.log('Warning: keyHash Validation not yet implemented...');
  return true;
}

// Set notification flag for Instance corresponding to |instanceId|, and also
// set the notification flag for the userId.
function _addNotification(instanceId) {
  var instance = store.state.instances[instanceId];
  if (!instance) {
    console.error('Could not find instance ' + instanceId);
    return false;
  }
  instance.notify = true;
  store.saveInstance(instanceId);
  _syncInstanceUI(instance, 'notify');
  // var user = store.state.roster[instance.rosterInfo.userId];
  // if (!user) {
    // console.error('User does not exist for instance ' + instance);
    // return false;
  // }
  // console.log('adding notification for instance ' + instanceId + ' of user ' + user.userId);
  // user.hasNotification = true;
  // _SyncUI('/roster/' + user.userId + '/hasNotification', true);
}

// Remove notification flag for Instance corresponding to |instanceId|, if it
// exists.
function _removeNotification(instanceId) {
  if (!instanceId) return;

  var instance = store.state.instances[instanceId];
  if (!instance) {
    console.error('Instance does not exist for ' + instanceId);
    return false;
  }
  instance.notify = false;
  store.saveInstance(instanceId);
  _syncInstanceUI(instance, 'notify');
  return true;
}

// Update the description for an instanceId.
// Assumes that |instanceId| is valid.
function receiveUpdateDescription(msg) {
  console.log('Updating description! ' + JSON.stringify(msg));
  var description = msg.data.description,
      instanceId = msg.data.instanceId,
      instance = store.state.instances[instanceId];
  if (!instance) {
    console.error('Could not update description - no instance: ' + instanceId);
    return false;
  }
  instance.description = description;
  _syncInstanceUI(instance, 'description');
  return true;
}

bgAppPageChannel.on('start-proxy-localhost-test', function () {
  _localTestProxying();
});

// --------------------------------------------------------------------------
//  Updating the UI
// --------------------------------------------------------------------------
function _SyncUI(path, value, op) {
  op = op || 'add';
  bgAppPageChannel.emit('state-change', [{
      op: op,
      path: path,
      value: value
  }]);
}
// Helper to consolidate syncing the instance on the UI side.
function _syncInstanceUI(instance, field) {
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
    store.state.me.networkDefaults[network].autoconnect = true;
  } else {
    store.state.me.networkDefaults[network].autoconnect = false;
  }
  store.saveMeToStorage();
}
