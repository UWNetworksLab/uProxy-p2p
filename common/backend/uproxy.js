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
   ProxyState: false, state: true, log, stateStorage, _localTestProxying */

// The channel to speak to the UI part of uproxy. The UI is running from the
// privileged part of freedom, so we can just set this to be freedom.
var uiChannel = freedom;

// Channels with module interface to speak to the various providers.

// Identity is a module that speaks to chat networks and does some message
// passing to manage contacts privilages and initiate proxying.
var identity = freedom.identity();

// Client is used to manage a peer connection to a contact that will proxy our
// connection. This module listens on a localhost port and forwards requests
// through the peer connection.
var client = freedom.uproxyclient();

// Server module; listens for peer connections and proxies their requests
// through the peer connection.
var server = freedom.uproxyserver();


// --------------------------------------------------------------------------
//  General UI interaction
// --------------------------------------------------------------------------
function sendFullStateToUI() {
  console.log("sending sendFullStateToUI state-change.");
  uiChannel.emit('state-change', [{op: 'replace', path: '', value: state}]);
}

// Define freedom bindings.
uiChannel.on('reset', function () { reset(); });

// Logs out of networks and resets data.
function reset() {
  log.debug('reset');
  identity.logout(null, null);
  stateStorage.reset(function() {
    // TODO: refactor so this isn't needed.
    state = stateStorage.state;
    console.log("reset state to: ", state);
    sendFullStateToUI();
  });
}

// Called from extension whenever the user clicks opens the extension popup.
// The intent is to reset its model - but this may or may not always be
// necessary. Improvements to come.
uiChannel.on('open-popup', function () {
  log.debug('open-popup. state:', state);
  sendFullStateToUI();
});

// Update local user's online status (away, busy, etc.).
identity.on('onStatus', function(data) {
  log.debug('onStatus: data:' + JSON.stringify(data));
  if (data.userId) { // userId is only specified when connecting or online.
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
  try {
    if (state.me.identities[data.userId]) {
      // My card changed.
      state.me.identities[data.userId] = data;
      _SyncUI('/me/clients/' + data.userId, data, 'add');
      // TODO: Handle changes that might affect proxying
    } else {
      updateUser(data);  // Not myself.
    }
  } catch (e) {
    console.log('Failure in onChange handler.  state.me = ' + JSON.stringify(state.me));
    console.log(e.stack);
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
  // TODO: only remove clients from the network we are logging out of.
  // Clear the clientsToInstance table.
  state.clientToInstance = {};
  state.me.networkDefaults[network].autoconnect = false;

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
  stateStorage.saveOptionsToStorage();
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
    if (clientId) identity.sendMessage(clientId, payload);
  }
});

// Updating our own UProxy instance's description.
uiChannel.on('notification-seen', function (userId) {
  var user = state.roster[userId];
  if (!user) {
    log.error('User ' + userId + ' does not exist!');
    return false;
  }
  user.hasNotification = false;
  // Go through clients, remove notification flag from any uproxy instance.
  for (var clientId in user.clients) {
    var instanceId = state.clientToInstance[clientId];
    if (instanceId) {
      _removeNotification(instanceId);
    }
  }
  // _removeNotification(user);
  // instance.notify = false;
  // stateStorage.saveInstance(id);
  // Don't need to re-sync with UI - expect UI to have done the change.
  // _syncInstanceUI(instance);
});

// --------------------------------------------------------------------------
//  Proxying
// --------------------------------------------------------------------------
// TODO: say not if we havn't given them permission :)
uiChannel.on('start-using-peer-as-proxy-server', function(peerInstanceId) {
  startUsingPeerAsProxyServer(peerInstanceId);
});

uiChannel.on('stop-proxying', function(peerInstanceId) {
  stopUsingPeerAsProxyServer(peerInstanceId);
});

client.on('sendSignalToPeer', function(data) {
    console.log('client(sendSignalToPeer):' + JSON.stringify(data) +
                ', sending to ' + data.peerId + ", which should map to " +
                    state.instanceToClient[data.peerId]);
  // TODO: don't use 'message' as a field in a message! that's confusing!
  // data.peerId is an instance ID.  convert.
  identity.sendMessage(
      state.instanceToClient[data.peerId],
      JSON.stringify({type: 'peerconnection-client', data: data.data}));
});

server.on('sendSignalToPeer', function(data) {
  console.log('server(sendSignalToPeer):' + JSON.stringify(data) +
                ', sending to ' + data.peerId);
  identity.sendMessage(
      state.instanceToClient[data.peerId],
      JSON.stringify({type: 'peerconnection-server', data: data.data}));
});

function startUsingPeerAsProxyServer(peerInstanceId) {
  var instance = state.instances[peerInstanceId];
  if (!instance) {
    log.error('Instance ' + peerInstanceId + ' does not exist for proxying.');
    return false;
  }
  if (Trust.YES != state.instances[peerInstanceId].trust.asProxy) {
    log.debug('Lacking permission to proxy through ' + peerInstanceId);
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
               'peerId': peerInstanceId});
}

function stopUsingPeerAsProxyServer(peerInstanceId) {
  var instance = state.instances[peerInstanceId];
  if (!instance) {
    log.error('Instance ' + peerInstanceId + ' does not exist!');
    return false;
  }
  // TODO: Handle revoked permissions notifications.
  // uiChannel.emit('state-change',
      // [{op: 'replace', path: '/me/peerAsProxy', value: ''}]);
  client.emit("stop");
  instance.status.proxy = ProxyState.OFF;
  _syncInstanceUI(instance, 'status');
}

// peerconnection-client -- sent from client on other side.
function handleSignalFromClientPeer(msg) {
  console.log('handleSignalFromClientPeer: ' + JSON.stringify(msg));
  // sanitize from the identity service
  server.emit('handleSignalFromPeer', {peerId: msg.fromClientId, data: msg.data});
}

// peerconnection-server -- sent from server on other side.
function handleSignalFromServerPeer(msg) {
  console.log('handleSignalFromServerPeer: ' + JSON.stringify(msg));
  // sanitize from the identity service
  client.emit('handleServerSignalToPeer', {peerId: msg.fromClientId, data: msg.data});
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

// Update trust state for a particular instance. Emits change to UI.
// |instanceId| - instance to change the trust levels upon.
// |action| - Trust action to execute.
// |received| - boolean of source of this action.
function _updateTrust(instanceId, action, received) {
  received = received || false;
  var asProxy = ['allow', 'deny', 'offer'].indexOf(action) < 0 ?
      !received : received;
  var trustValue = TrustOp[action];
  var instance = state.instances[instanceId];
  if (!instance) {
    log.error('Cannot find instance ' + instanceId + ' for a trust change!');
    return false;
  }
  if (asProxy) {
    instance.trust.asProxy = trustValue;
  } else {
    instance.trust.asClient = trustValue;
  }
  // Update UI. TODO(uzimizu): Local storage as well?
  stateStorage.saveInstance(instanceId);
  stateStorage.syncRosterFromInstanceId(instanceId);

  // uiChannel.emit('state-change', [{
      // op: 'replace', path: '/instances/' + instance.instanceId, value: instance
  // }]);
  return true;
}

var _msgReceivedHandlers = {
    'notify-instance': receiveInstance,
    'notify-consent': receiveConsent,
    'update-description': handleUpdateDescription,
    'peerconnection-server' : handleSignalFromServerPeer,
    'peerconnection-client' : handleSignalFromClientPeer
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
      return;
    }
    _addNotification(instanceId);
    _updateTrust(instanceId, msgType, true);  // received = true
    return;
  }

  // Other type of message - instance or proxy state update.
  var handler = null;
  // If the message is not being sent by us...
  if (!beingSent) {
    handler = _msgReceivedHandlers[msgType];
  }
  if (!handler) {
    log.error('No handler for sent message type: ' + msgType);
    return;
  }
  handler(msgInfo, msgInfo.to);
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
  var instance = stateStorage.instanceOfUserId(userId);
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
}

// TODO(uzimizu): Figure out best way to request new users to install UProxy if
// they don't have any uproxy clients.

// Examine |client| and synchronize instance data if it's a new UProxy client.
// Returns true if |client| is a valid uproxy client.
function _checkUProxyClientSynchronization(client) {
  if (!stateStorage.isMessageableUproxyClient(client)) {
    return false;
  }
  var clientId = client.clientId;
  var clientIsNew = !(clientId in state.clientToInstance);

  if (clientIsNew) {
    log.debug('Aware of new UProxy client. Sending instance data.' +
        JSON.stringify(client));
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
function _getMyId() {
  for (var id in state.me.identities) {
    return id;
  }
}

// Should only be called after we have received an onChange event with our own
// details.
function makeMyInstanceMessage() {
  var firstIdentity = state.me.identities[_getMyId()];
  return JSON.stringify({
    type: 'notify-instance',
    instanceId: '' + state.me.instanceId,
    description: '' + state.me.description,
    keyHash: '' + state.me.keyHash,
    rosterInfo: {
      userId: firstIdentity.userId,
      name: firstIdentity.name,
      network: firstIdentity.network,
      url: firstIdentity.url
    }
  });
}

// Send a notification about my instance data to a particular clientId.
// Assumes |client| corresponds to a valid UProxy instance, but does not assume
// that we've received the other side's Instance data yet.
function sendInstance(client) {
  var instancePayload = makeMyInstanceMessage();
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
  var instanceId  = msg.data.instanceId;
  var userId      = msg.fromUserId;
  var clientId    = msg.fromClientId;

  // Intended JSONpatch operation.
  var instanceOp  = (instanceId in state.instances) ? 'replace' : 'add';

  // Update the local instance information.
  stateStorage.syncInstanceFromInstanceMessage(userId, clientId, msg.data);
  stateStorage.saveInstance(instanceId);

  // If we've had relationships to this instance, send them our consent bits.
  if (instanceOp == 'replace') {
    sendConsent(state.instances[instanceId]);
  }

  // Update UI's view of instances and mapping.
  // TODO: This can probably be made smaller.
  uiChannel.emit('state-change', [{
      op: instanceOp,
      path: '/instances/' + instanceId,
      value: state.instances[instanceId]
  }]);
  uiChannel.emit('state-change', [
    { op: 'replace', path: '/clientToInstance', value: state.clientToInstance },
    { op: 'replace', path: '/instanceToClient', value: state.instanceToClient }
  ]);
  return true;
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
  stateStorage.saveInstance(instanceId);
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
  log.debug('Warning: keyHash Validation not yet implemented...');
  return true;
}

// Set notification flag for Instance corresponding to |instanceId|, and also
// set the notification flag for the userId.
function _addNotification(instanceId) {
  var instance = state.instances[instanceId];
  if (!instance) {
    log.error('Could not find instance ' + instanceId);
    return false;
  }
  instance.notify = true;
  stateStorage.saveInstance(instanceId);
  _syncInstanceUI(instance, 'notify');
  var user = state.roster[instance.rosterInfo.userId];
  if (!user) {
    console.error('User does not exist for instance ' + instance);
    return false;
  }
  // state.notifications += user.hasNotification? 1 : 0;
  user.hasNotification = true;
  uiChannel.emit('state-change', [{
      op: 'replace',
      path: '/roster/' + user.userId + '/hasNotification',
      value: true
  }]);
}

// Remove notification flag for Instance corresponding to |instanceId|, if it
// exists.
function _removeNotification(instanceId) {
  if (!instanceId) return;

  var instance = state.instances[instanceId];
  if (!instance) {
    log.error('Instance does not exist for ' + instanceId);
    return false;
  }
  instance.notify = false;
  stateStorage.saveInstance(instanceId);
  _syncInstanceUI(instance, 'notify');
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
  _syncInstanceUI(instance, 'description');
  return true;
}

uiChannel.on('start-proxy-localhost-test', function () {
  _localTestProxying();
});

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
    stateStorage.me.networkDefaults[network].autoconnect = true;
  } else {
    stateStorage.me.networkDefaults[network].autoconnect = false;
  }
  stateStorage.saveMeToStorage();
}
