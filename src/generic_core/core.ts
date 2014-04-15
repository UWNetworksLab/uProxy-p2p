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
/// <reference path='../uproxy.ts'/>
/// <reference path='state-storage.ts' />
/// <reference path='constants.ts' />
/// <reference path='social.ts' />
// TODO: Create a copy rule which automatically moves all third_party
// typescript declarations to a nicer path.
/// <reference path='../../node_modules/freedom-typescript-api/interfaces/freedom.d.ts' />
/// <reference path='../../node_modules/socks-rtc/src/interfaces/communications.d.ts' />

// TODO: remove these once these 'modules' become typescripted.
declare var store :Core.State;
declare var restrictKeys :any;


// This is the channel to speak to the UI component of uProxy.
// The UI is running from the privileged part of freedom, so we can just set
// this to be freedom, and communicate using 'emit's and 'on's.
var bgAppPageChannel = freedom;

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
  console.log('sending ALL state to UI.', JSON.stringify(store.state));
  Core.sendUpdate(uProxy.Update.ALL);
}


// Logs out of networks and resets data.
function reset() {
  console.log('reset');
  for (var network in Social.networks) {
    Social.networks[network].api.logout();
  }
  store.reset().then(sendFullStateToUI);
}

/**
 * Primary uProxy backend. Handles which social networks one is connected to,
 * sends updaes to the UI, and handles commands from the UI.
 */
module Core {

  // TODO: Figure out cleaner way to make freedom handle enums-as-strings.

  /**
   * Install a handler for commands received from the UI.
   */
  export var onCommand = (cmd :uProxy.Command, handler:any) => {
    bgAppPageChannel.on('' + cmd, handler);
  }

  /**
   * Send an Update message to the UI.
   */
  export var sendUpdate = (update :uProxy.Update, data?:any) => {
    switch(update) {
      case uProxy.Update.ALL:
        bgAppPageChannel.emit('' + update, store.state);
        break

      // TODO: Implement the finer-grained Update messages.
      default:
        console.warn('Not yet implemented.');
        break;
    }
  }

  /**
   * Access various social networks using the Social API.
   */
  export var login = (networkName:string, explicit:boolean=false) => {
    var network = Social.getNetwork(networkName);
    if (null === network) {
      console.warn('Could not login to ' + network);
      return;
    }
    network.api.login({  // :freedom.Social.LoginRequest
          agent: 'uproxy',
          version: '0.1',
          url: 'https://github.com/UWNetworksLab/UProxy',
          interactive: Boolean(network),
          rememberLogin: true
        })
        .then(sendFullStateToUI)
        .then(() => {
          console.log('Successfully logged in to ' + networkName);
        });

    store.state.me.networkDefaults[networkName].autoconnect = explicit;
    store.saveMeToStorage();
  }

  /**
   * Log-out of |networkName|.
   */
  export var logout = (networkName:string) : void => {
    var network = Social.getNetwork(networkName);
    if (null === network) {
      console.warn('Could not logout of ' + networkName);
      return;
    }
    network.api.logout().then(() => {
      console.log('Successfully logged out of ' + networkName);
    });
    // TODO: only remove clients from the network we are logging out of.
    // Clear the clientsToInstance table.
    store.state.clientToInstance = {};
    store.state.instanceToClient = {};
    _syncMappingsUI();
    store.state.me.networkDefaults[networkName].autoconnect = false;
    store.saveMeToStorage();
  }

  /**
   * Send a notification about my instance data to a particular clientId.
   * Assumes |client| corresponds to a valid uProxy instance, but does not assume
   * that we've received the other side's instance data yet.
   */
  export var sendInstance = (clientId:string) => {
    var instancePayload = makeMyInstanceMessage();
    console.log('sendInstance -> ' + clientId, instancePayload);
    // Queue clientIDs if we're not ready to send instance message.
    if (!instancePayload) {
      _sendInstanceQueue.push(clientId);
      console.log('Queueing ' + clientId + ' for an instance message.');
      return false;
    }
    defaultNetwork.sendMessage(clientId, instancePayload);
    return true;
  }

  /**
   * Primary handler for synchronizing Instance data. Updates an instance-client
   * mapping, and emit state-changes to the UI. In no case will this function fail
   * to generate or update an entry of the instance table.
   * TODO: support instance being on multiple chat networks.
   * Note: does not assume that a roster entry exists for the user that send the
   * instance data. Sometimes we get an instance data message from user that is
   * not (yet) in the roster.
   * |rawMsg| is a DEFAULT_MESSAGE_ENVELOPE{data = DEFAULT_INSTANCE_MESSAGE}.
   */
  export var receiveInstance = (rawMsg) : Promise<void> => {
    console.log('receiveInstance from ' + rawMsg.fromUserId);

    var msg = restrictKeys(C.DEFAULT_MESSAGE_ENVELOPE, rawMsg);
    msg.data = restrictKeys(C.DEFAULT_INSTANCE_MESSAGE, rawMsg.data);
    msg.data.rosterInfo = restrictKeys(
        C.DEFAULT_INSTANCE_MESSAGE_ROSTERINFO, rawMsg.data.rosterInfo);

    var instanceId  = msg.data.instanceId;
    var userId      = msg.fromUserId;
    var clientId    = msg.fromClientId;

    // Update the local instance information.
    store.syncInstanceFromInstanceMessage(userId, clientId, msg.data);
    return store.saveInstance(instanceId).then(() => {
      // Intended JSONpatch operation.
      // TODO: remove jsonpatch
      var instanceOp  = (instanceId in store.state.instances) ? 'replace' : 'add';
      // If we've had relationships to this instance, send them our consent bits.
      if (instanceOp == 'replace') {
        sendConsent(store.state.instances[instanceId]);
      }
      // Update UI's view of instances and mapping.
      // TODO: This can probably be made smaller.
      Core.syncInstanceUI_(store.state.instances[instanceId]);
      _syncMappingsUI();
    });
  }

  // Helper to consolidate syncing the instance on the UI side.
  // TODO: Convert into an actual interface-specific update type.
  export var syncInstanceUI_ = (instance, field?) => {
    if (!instance) {
      console.error('Cannot sync with null instance.');
    }
    var fieldStr = field? '/' + field : '';
    _SyncUI('/instances/' + instance.instanceId + fieldStr,
            field? instance[field] : instance);
  }

  /**
   * Update user's description of their current device.
   */
  export var updateDescription = (data) => {
    store.state.me.description = data;  // UI side already up-to-date.
    // TODO: save personal description to storage.
    var payload = JSON.stringify({
      type: 'update-description',
      instanceId: '' + store.state.me.instanceId,
      description: '' + store.state.me.description
    });

    // Send the new description to ALL currently online friend instances.
    var instanceIds = Object.keys(store.state.instances);
    instanceIds.map(toClientId)
      .filter((clientId:string) => { return Boolean(clientId); })
      .forEach((clientId:string) => {
        defaultNetwork.sendMessage(clientId, payload);
      });
  }

  /**
   * Modify the consent value for an instance, because the user clicked on
   * one of th consent buttons w.r.t another user.
   * Update trust level for an instance, and possibly send a message to the client
   * for the instance that we changed.
   * TODO: Probably move this into the :Instance class once it exists.
   * TODO: Type |data|.
   */
  export var modifyConsent = (data) => {
    var iId = data.instanceId;
    // Set trust level locally, then notify through XMPP if possible.
    _updateTrust(data.instanceId, data.action, false);  // received = false
    var clientId = toClientId(iId);
    if (!clientId) {
      console.log('Warning! Cannot change trust level because client ID does not ' +
                'exist for instance ' + iId + ' - they are probably offline.');
      return false;
    }
    defaultNetwork.sendMessage(clientId, JSON.stringify({type: data.action}));
    return true;
  }

  /**
   * Returns the |clientId| corresponding to |instanceId|.
   */
  var toClientId = (instanceId:string) : string => {
    return store.state.instanceToClient[instanceId];
  }

}  // module Core


// Prepare all the social providers from the manifest.
var networks = Social.initializeNetworks();
// TODO: Remove this when we have multiple social providers 'for real'.
var defaultNetwork = networks['websocket'].api;

// Only logged in if at least one entry in identityStatus is 'online'.
function iAmLoggedIn() {
  var networks = Object.keys(store.state.identityStatus);
  return networks.some((network) => {
    return 'online' == store.state.identityStatus[network].status;
  });
}

// --------------------------------------------------------------------------
// Signalling channel hooks.
// --------------------------------------------------------------------------
// peerId is a client ID.
client.on('sendSignalToPeer', (data:PeerSignal) => {
    console.log('client(sendSignalToPeer):' + JSON.stringify(data) +
                ', sending to client: ' + data.peerId + ", which should map to instance: " +
                    store.state.clientToInstance[data.peerId]);
  // TODO: don't use 'message' as a field in a message! that's confusing!
  // data.peerId is an instance ID.  convert.
  defaultNetwork.sendMessage(data.peerId,
      JSON.stringify({type: 'peerconnection-client', data: data.data}));
});

// Make this take an actual peer object type.
server.on('sendSignalToPeer', (data:PeerSignal) => {
  console.log('server(sendSignalToPeer):' + JSON.stringify(data) +
                ', sending to client: ' + data.peerId);
  defaultNetwork.sendMessage(data.peerId,
      JSON.stringify({type: 'peerconnection-server', data: data.data}));
});

// --------------------------------------------------------------------------
//  Proxying
// --------------------------------------------------------------------------
// Begin SDP negotiations with peer. Assumes |peer| exists.
var startUsingPeerAsProxyServer = (peerInstanceId:string) => {
  // TODO: don't allow if we havn't given them permission :)
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
  Core.syncInstanceUI_(instance, 'status');

  // TODO: sync properly between the extension and the app on proxy settings
  // rather than this cooincidentally the same data.
  client.emit('start',
              {'host': '127.0.0.1', 'port': 9999,
               // peerId of the peer being routed to.
               'peerId': store.state.instanceToClient[peerInstanceId]});

  // This is a temporary hack which makes the other end aware of your proxying.
  // TODO(uzimizu): Remove this once proxying is happening *for real*.
  defaultNetwork.sendMessage(
      store.state.instanceToClient[peerInstanceId],
      JSON.stringify({
          type: 'newly-active-client',
          instanceId: store.state.me.instanceId
      }));
}

var stopUsingPeerAsProxyServer = (peerInstanceId:string) => {
  var instance = store.state.instances[peerInstanceId];
  if (!instance) {
    console.error('Instance ' + peerInstanceId + ' does not exist!');
    return false;
  }
  // TODO: Handle revoked permissions notifications.
  // [{op: 'replace', path: '/me/peerAsProxy', value: ''}]);

  client.emit('stop');
  instance.status.proxy = C.ProxyState.OFF;
  Core.syncInstanceUI_(instance, 'status');

  // TODO: this is also a temporary hack.
  defaultNetwork.sendMessage(
      store.state.instanceToClient[peerInstanceId],
      JSON.stringify({
          type: 'newly-inactive-client',
          instanceId: store.state.me.instanceId
      }));
}

// peerconnection-client -- sent from client on other side.
// TODO: typing for the msg so we don't get weird things like data.data... @_@
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
  Core.syncInstanceUI_(instance, 'status');
}

function handleInactiveClient(msg) {
  var instanceId = msg.data.instanceId;
  var instance = store.state.instances[instanceId];
  if (!instance) {
    console.error('Cannot be proxy for nonexistent instance.');
    return;
  }
  instance.status.client = C.ProxyState.OFF;
  Core.syncInstanceUI_(instance, 'status');
}

// --------------------------------------------------------------------------
//  Trust
// --------------------------------------------------------------------------
// action -> target trust level.
// TODO: Remove once the new consent stuff is in.
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
  Core.syncInstanceUI_(instance, 'trust');
  console.log('Instance trust changed. ' + JSON.stringify(instance.trust));
  return true;
}

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
  // TODO: Remove after typing.
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
defaultNetwork.on('onStatus', receiveStatus);

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
defaultNetwork.on('onChange', receiveChange);

// TODO: clean this up for the new consent bits.
var _msgReceivedHandlers = {
    'allow': receiveTrustMessage,
    'offer': receiveTrustMessage,
    'deny': receiveTrustMessage,
    'request-access': receiveTrustMessage,
    'cancel-request': receiveTrustMessage,
    'accept-offer': receiveTrustMessage,
    'decline-offer': receiveTrustMessage,
    'notify-instance': Core.receiveInstance,
    'notify-consent': receiveConsent,
    'update-description': receiveUpdateDescription,
    'peerconnection-server' : receiveSignalFromServerPeer,
    'peerconnection-client' : receiveSignalFromClientPeer,
    'newly-active-client' : handleNewlyActiveClient,
    'newly-inactive-client' : handleInactiveClient
};


defaultNetwork.on('onMessage', (msgInfo) => {
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


/**
 * Update data for a user, typically when new client data shows up. Notifies
 * all new UProxy clients of our instance data, and preserve existing hooks.
 * Does not do a complete replace - does a merge of any provided key values.
 *
 * |newData| - Incoming JSON info for a single user. Assumes to have been
 *             restricted to DEFAULT_ROSTER_ENTRY already.
 * TODO: Use types!!
 */
function updateUser(newData) {
  console.log('<--- XMPP(friend) [' + newData.name + ']', newData);
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
    Core.sendInstance(clientId);
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
    defaultNetwork.sendMessage(clientId, instancePayload);
  });
  _sendInstanceQueue = [];
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
  defaultNetwork.sendMessage(clientId, consentPayload);
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
  Core.syncInstanceUI_(instance, 'trust');
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
  Core.syncInstanceUI_(instance, 'notify');
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
  Core.syncInstanceUI_(instance, 'notify');
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
  Core.syncInstanceUI_(instance, 'description');
  return true;
}


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


function _syncMappingsUI() {
  bgAppPageChannel.emit('state-change', [
    { op: 'replace', path: '/clientToInstance',
      value: store.state.clientToInstance },
    { op: 'replace', path: '/instanceToClient',
      value: store.state.instanceToClient }
  ]);
}


// --------------------------------------------------------------------------
// Register Core responses to UI commands.
// --------------------------------------------------------------------------
Core.onCommand(uProxy.Command.READY, sendFullStateToUI);
Core.onCommand(uProxy.Command.RESET, reset);
// When the login message is sent from the extension, assume it's explicit.
Core.onCommand(uProxy.Command.LOGIN, (network) => { Core.login(network, true); });
Core.onCommand(uProxy.Command.LOGOUT, Core.logout)

Core.onCommand(uProxy.Command.SEND_INSTANCE, Core.sendInstance);
Core.onCommand(uProxy.Command.MODIFY_CONSENT, Core.modifyConsent);

Core.onCommand(uProxy.Command.START_PROXYING, startUsingPeerAsProxyServer);
Core.onCommand(uProxy.Command.STOP_PROXYING, stopUsingPeerAsProxyServer);

Core.onCommand(uProxy.Command.CHANGE_OPTION, (data) => {
  store.state.options[data.key] = data.value;
  store.saveOptionsToStorage().then(() => {;
    console.log('saved options ' + JSON.stringify(store.state.options));
    // TODO: Replace this JSON patch.
    bgAppPageChannel.emit('state-change',
        [{op: 'replace', path: '/options/'+data.key,
         value: data.value}]);
  });
  // TODO: Handle changes that might affect proxying.
});

Core.onCommand(uProxy.Command.UPDATE_DESCRIPTION, Core.updateDescription);
Core.onCommand(uProxy.Command.DISMISS_NOTIFICATION, (userId) => {
  // TODO: Implement an actual notifications/userlog pipeline.
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


// TODO: make the invite mechanism an actual process.
Core.onCommand(uProxy.Command.INVITE, (userId:string) => {
  defaultNetwork.sendMessage(userId, 'Join UProxy!');
});
