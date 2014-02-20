/**
 * uproxy.ts
 *
 * This is the primary uproxy code. It maintains in-memory state,
 * checkpoints information to local storage, and synchronizes state with the
 * front-end.
 *
 * In-memory state includes:
 *  - Roster, which is a list of contacts, always synced with XMPP friend lists.
 *  - Instances, which is a list of active UProxy installs.
 */
/// <reference path='../../generic_ui/scripts/ui.d.ts' />
/// <reference path='constants.d.ts' />
// import C = Constants;

// TODO: remove these once these 'modules' become typescripted.
declare var freedom:any;
declare var store:any;
declare var restrictKeys:any;
declare var _localTestProxying:any;

// TODO: refactor such that this reflects the UI interface.
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
var client = freedom['SocksToRtc']();

// Server allows us to act as a proxy for our contacts.
// Server module; listens for peer connections and proxies their requests
// through the peer connection.
var server = freedom['RtcToNet']();

// Sometimes we receive other uproxy instances before we've received our own
// XMPP onChange notification, which means we cannot yet build an instance
// message.
var _sendInstanceQueue = [];
var _memoizedInstanceMessage = null;


// --------------------------------------------------------------------------
//  General UI interaction
// --------------------------------------------------------------------------
function sendFullStateToUI() {
  console.log("sending sendFullStateToUI state-change.", store.state);
  bgAppPageChannel.emit('state-refresh', store.state);
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
  console.log('state: ', store.state);
  sendFullStateToUI();  // Send the extension the full state.
});

// When the login moessage is sent from the extension, assume it's explicit.
bgAppPageChannel.on('login', function(network) { login(network, true); });
bgAppPageChannel.on('logout', function(network) { logout(network); });

function login(network, explicit) {
  explicit = explicit || false;
  network = network || undefined;
  identity.login({
    agent: 'uproxy',
    version: '0.1',
    url: 'https://github.com/UWNetworksLab/UProxy',
    interactive: Boolean(network),
    network: network
  }, sendFullStateToUI);
  if (network) {
    store.state.me.networkDefaults[network].autoconnect = explicit;
  }
  store.saveMeToStorage();
}

function logout(network) {
  identity.logout(null, network);
  // TODO: only remove clients from the network we are logging out of.
  // Clear the clientsToInstance table.
  store.state.clientToInstance = {};
  store.state.instanceToClient = {};
  _syncMappingsUI();
  store.state.me.networkDefaults[network].autoconnect = false;
  store.saveMeToStorage();
}

// Only logged in if at least one entry in identityStatus is 'online'.
function iAmLoggedIn() {
  var networks = Object.keys(store.state.identityStatus);
  return networks.some(function(network) {
    return 'online' == store.state.identityStatus[network].status;
  });
}

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
  bgAppPageChannel.emit('state-change', [{op: 'replace', path: '/options/'+data.key,
                                          value: data.value}]);
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
  if (C.Trust.YES != store.state.instances[peerInstanceId].trust.asProxy) {
    console.log('Lacking permission to proxy through ' + peerInstanceId);
    return false;
  }
  // TODO: Cleanly disable any previous proxying session.
  instance.status.proxy = C.ProxyState.RUNNING;
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
  instance.status.proxy = C.ProxyState.OFF;
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
  instance.status.client = C.ProxyState.RUNNING;
  _syncInstanceUI(instance, 'status');
}

function handleInactiveClient(msg) {
  var instanceId = msg.data.instanceId;
  var instance = store.state.instances[instanceId];
  if (!instance) {
    console.error('Cannot be proxy for nonexistent instance.');
    return;
  }
  instance.status.client = C.ProxyState.OFF;
  _syncInstanceUI(instance, 'status');
}

// --------------------------------------------------------------------------
//  Trust
// --------------------------------------------------------------------------
// action -> target trust level.
var TrustOp = {
  // If Alice |action|'s Bob, then Bob acts as the client.
  'allow': C.Trust.YES,
  'offer': C.Trust.OFFERED,
  'deny': C.Trust.NO,
  // Bob acts as the proxy.
  'request-access': C.Trust.REQUESTED,
  'cancel-request': C.Trust.NO,
  'accept-offer': C.Trust.YES,
  'decline-offer': C.Trust.NO
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

// Expects message in the format data = {
//    message: string,
//    network: string,
//    status: string,
//    userId: string
// }
//
function receiveStatus(data) {
  console.log('onStatus: ' + JSON.stringify(data));
  data = restrictKeys(C.DEFAULT_STATUS, data);
  // userId is only specified when connecting or online.
  if (data.userId.length) {
    store.state.identityStatus[data.network] = data;
    bgAppPageChannel.emit('state-change',
        [{op: 'add', path: '/identityStatus/' + data.network, value: data}]);
    if (!store.state.me.identities[data.userId]) {
      store.state.me.identities[data.userId] = {
        userId: data.userId
      };
    }
  }
}

// Update local user's online status (away, busy, etc.).
identity.on('onStatus', receiveStatus);

// Called when a contact (or ourselves) changes state, whether being online or
// the description.
// |rawData| is a DEFAULT_ROSTER_ENTRY.
function receiveChange(rawData) {
  /* if (!iAmLoggedIn()) {
    console.log('<--- XMPP(offline) [' + rawData.name + '] ignored\n', rawData);
    return false;
  } */
  try {
    var data = restrictKeys(C.DEFAULT_ROSTER_ENTRY, rawData);
    for (var c in rawData.clients) {
      data.clients[c] = restrictKeys(C.DEFAULT_ROSTER_CLIENT_ENTRY,
                                     rawData.clients[c]);
    }

    // vCard for myself - update if we have onStatus'd ourselves in the past.
    if (store.state.me.identities[data.userId]) {
      updateSelf(data);
      // TODO: Handle changes that might affect proxying
    } else {
      updateUser(data);  // Not myself.
    }
  } catch (e) {
    console.log('Failure in onChange handler.  store.state.me = ' +
        JSON.stringify(store.state.me) + ', input message: ' +
        JSON.stringify(rawData));
    console.log(e.stack);
  }
}
identity.on('onChange', receiveChange);

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
  // Replace the JSON str with actual data attributes, then flatten.
  msgInfo.messageText = msgInfo.message;
  delete msgInfo.message;
  try {
    msgInfo.data = JSON.parse(msgInfo.messageText);
  } catch(e) {
    console.log(msgInfo);
    console.error("Message was not JSON");
    return;
  }
  // Call the relevant handler.
  var msgType = msgInfo.data.type;
  console.log('<--- msg [' + msgType + '] -- ' + msgInfo.fromClientId + '\n',
              msgInfo);
  if (!(msgType in _msgReceivedHandlers)) {
    console.error('No handler for message type: ' +
        JSON.stringify(msgInfo.data) + "; typeof: " + (typeof msgInfo.data));
    return;
  }
  _msgReceivedHandlers[msgType](msgInfo);
});


function updateSelf(data) {
  console.log('<-- XMPP(self) [' + data.name + ']\n', data);
  var myIdentities = store.state.me.identities;
  var loggedIn = Object.keys(data.clients).length > 0;

  myIdentities[data.userId] = data;
  _SyncUI('/me/identities/' + data.userId, data, 'add');

  // If it's ourselves for the first time, it also means we can
  // send instance messages to any queued up uProxy clientIDs.
  console.log('Self state: { loggedIn: "' + loggedIn + '".');
  if (loggedIn) {
    sendQueuedInstanceMessages();
  }
}


// Update data for a user, typically when new client data shows up. Notifies
// all new UProxy clients of our instance data, and preserve existing hooks.
// Does not do a complete replace - does a merge of any provided key values.
//
// |newData| - Incoming JSON info for a single user. Assumes to have been
//             restricted to DEFAULT_ROSTER_ENTRY already.
function updateUser(newData) {
  console.log('<--- XMPP(friend) [' + newData.name + ']\n', newData);
  var userId = newData.userId,
      userOp = 'replace',
      existingUser = store.state.roster[userId];

  if (!existingUser) {
    store.state.roster[userId] = newData;
    userOp = 'add';
  }
  var user = store.state.roster[userId];
  var instance = store.instanceOfUserId(userId);
  var clientId;
  user.name = newData.name;
  user.imageData = newData.imageData || null;
  user.url = newData.url || null;
  for (clientId in newData.clients) {
    user.clients[clientId] = newData.clients[clientId];
  }

  for (clientId in user.clients) {
    var client = user.clients[clientId];
    if ('offline' == client.status) {    // Delete offline clients.
      delete user.clients[clientId];
      continue;
    }
    if (! (clientId in user.clients)) {  // Add new clients.
      user.clients[clientId] = client;
    }
    // Inform UProxy instances of each others' ephemeral clients.
    _checkUProxyClientSynchronization(client);
  }

  _SyncUI('/roster/' + userId, user, userOp);
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
    console.log('New uProxy Client (' + client.network + ')' + clientId + '\n',
                client);
    // Set the instance mapping to null as opposed to undefined, to indicate
    // that we know the client is pending its corresponding instance data.
    store.state.clientToInstance[clientId] = null;
    sendInstance(clientId);
  }
  return true;
}

function _getMyStoredId() {
  for (var id in store.state.me.identities) {
    return id;
  }
  console.log('Warning: I don\'t have any identities yet.');
  return null;
}


// Generate my instance message, to send to other uProxy installations, to
// inform them that we're also a uProxy installation and can engage in
// shenanigans. However, we can only build the instance message if we've
// received an onChange notification for ourselves to populate at least one
// identity.
//
// Returns the JSON of the instance message if successful - otherwise it
// returns null if we're not ready.
function makeMyInstanceMessage() {
  var result;
  try {
    var firstIdentity = store.state.me.identities[_getMyStoredId()];
    if (!firstIdentity || !firstIdentity.clients ||
        0 === Object.keys(firstIdentity.clients).length) {
      return null;
    }
    firstIdentity.network = firstIdentity.clients[Object.keys(
        firstIdentity.clients)[0]].network;
    result = restrictKeys(C.DEFAULT_INSTANCE_MESSAGE, store.state.me);
    result.rosterInfo = restrictKeys(C.DEFAULT_INSTANCE_MESSAGE_ROSTERINFO,
                                         firstIdentity);
  } catch (e) {
    console.log("Failed to repair identity when making an instance message.\n");
    console.log("firstIdentity = " + JSON.stringify(
        firstIdentity, null, " ") + "\n");
    console.log("store.state.me = " + JSON.stringify(
        store.state.me, null, " ") + "\n");
    throw e;
  }
  return JSON.stringify(result);
}

// Send a notification about my instance data to a particular clientId.
// Assumes |client| corresponds to a valid UProxy instance, but does not assume
// that we've received the other side's Instance data yet.
function sendInstance(clientId) {
  var instancePayload = makeMyInstanceMessage();
  console.log('sendInstance -> ' + clientId, instancePayload);
  // Queue clientIDs if we're not ready to send instance message.
  if (!instancePayload) {
    _sendInstanceQueue.push(clientId);
    console.log('Queueing ' + clientId + ' for an instance message.');
    return false;
  }
  identity.sendMessage(clientId, instancePayload);
  return true;
}

// Only called when we receive an onChange notification for ourselves for the
// first time, to send pending instance messages.
function sendQueuedInstanceMessages() {
  if (0 === _sendInstanceQueue.length) {
    return;  // Don't need to do anything.
  }
  var instancePayload = makeMyInstanceMessage();
  if (!instancePayload) {
    console.error('Still not ready to construct instance payload.');
    return false;
  }
  _sendInstanceQueue.forEach(function(clientId) {
    console.log('Sending previously queued instance message to: ' + clientId + '.');
    identity.sendMessage(clientId, instancePayload);
  });
  _sendInstanceQueue = [];
  return true;
}



// Primary handler for synchronizing Instance data. Updates an instance-client
// mapping, and emit state-changes to the UI. In no case will this function fail
// to generate or update an entry of the instance table.
// TODO: support instance being on multiple chat networks.
// Note: does not assume that a roster entry exists for the user that send the
// instance data. Sometimes we get an instance data message from user that is
// not (yet) in the roster.
// |rawMsg| is a DEFAULT_MESSAGE_ENVELOPE{data = DEFAULT_INSTANCE_MESSAGE}.
function receiveInstance(rawMsg) {
  console.log('receiveInstance from ' + rawMsg.fromUserId);

  var msg = restrictKeys(C.DEFAULT_MESSAGE_ENVELOPE, rawMsg);
  msg.data = restrictKeys(C.DEFAULT_INSTANCE_MESSAGE, rawMsg.data);
  msg.data.rosterInfo = restrictKeys(
      C.DEFAULT_INSTANCE_MESSAGE_ROSTERINFO, rawMsg.data.rosterInfo);

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
  _syncMappingsUI();
  return true;
}

// Send consent bits to re-synchronize consent with remote |instance|.
// This happens *after* receiving an instance notification for an instance which
// we already have a history with.
function sendConsent(instance) {
  console.log('sendConsent[' + instance.rosterInfo.name + ']', instance);
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
  var theirConsent     = msg.data.consent,     // Their view of consent.
      instanceId  = msg.data.instanceId,  // InstanceId of the sender.
      instance    = store.state.instances[instanceId];
  if (!instance) {
    console.log('receiveConsent: Instance ' + instanceId + ' not found!');
    return false;
  }
  // Determine my own consent bits, compare with their consent and remap.
  var oldTrustAsProxy = instance.trust.asProxy;
  var oldTrustAsClient = instance.trust.asClient;
  var myConsent = _determineConsent(instance.trust);
  instance.trust = _composeTrustFromConsent(myConsent, theirConsent);

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
  return { asProxy:  [C.Trust.YES, C.Trust.OFFERED].indexOf(trust.asClient) >= 0,
           asClient: [C.Trust.YES, C.Trust.REQUESTED].indexOf(trust.asProxy) >= 0 };
}

function _composeTrustFromConsent(myConsent, theirConsent) {
  return {
      asProxy: theirConsent.asProxy?
          (myConsent.asClient? C.Trust.YES : C.Trust.OFFERED) :
          (myConsent.asClient? C.Trust.REQUESTED : C.Trust.NO),
      asClient: theirConsent.asClient?
          (myConsent.asProxy? C.Trust.YES : C.Trust.REQUESTED) :
          (myConsent.asProxy? C.Trust.OFFERED : C.Trust.NO)
  };
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

bgAppPageChannel.on('send-instance', function(clientId) {
  sendInstance(clientId);
});

bgAppPageChannel.on('start-proxy-localhost-test', function () {
  _localTestProxying();
});

// --------------------------------------------------------------------------
//  Updating the UI
// --------------------------------------------------------------------------
function _SyncUI(path, value, op?) {
  op = op || 'add';
  bgAppPageChannel.emit('state-change', [{
      op: op,
      path: path,
      value: value
  }]);
}
// Helper to consolidate syncing the instance on the UI side.
function _syncInstanceUI(instance, field?) {
  var fieldStr = field? '/' + field : '';
  _SyncUI('/instances/' + instance.instanceId + fieldStr,
          field? instance[field] : instance);
}

function _syncMappingsUI() {
  bgAppPageChannel.emit('state-change', [
    { op: 'replace', path: '/clientToInstance',
      value: store.state.clientToInstance },
    { op: 'replace', path: '/instanceToClient',
      value: store.state.instanceToClient }
  ]);
}
