/**
 * core.ts
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
/// <reference path='util.ts' />
/// <reference path='../interfaces/instance.d.ts' />
/// <reference path='../interfaces/ui.d.ts' />
// TODO: Create a copy rule which automatically moves all third_party
// typescript declarations to a nicer path.
/// <reference path='../../node_modules/freedom-typescript-api/interfaces/freedom.d.ts' />
/// <reference path='../../node_modules/freedom-typescript-api/interfaces/social.d.ts' />
/// <reference path='../../node_modules/socks-rtc/src/interfaces/communications.d.ts' />

declare var store :Core.State;  // From start-uproxy.ts.

// This is the channel to speak to the UI component of uProxy.
// The UI is running from the privileged part of freedom, so we can just set
// this to be freedom, and communicate using 'emit's and 'on's.
var bgAppPageChannel = freedom;

// The socks-rtc client and server allows us to proxy through / for other uProxy
// peers. See [https://github.com/uProxy/socks-rtc] for more information.
var client = freedom['SocksToRtc']();
var server = freedom['RtcToNet']();
// The Core's responsibility is to pass messages across the signalling
// channel using the User / Instance mechanisms.


// Entry-point into the UI.
class UIConnector implements uProxy.UIAPI {

  /**
   * Send an Update message to the UI.
   * TODO: Turn this private and make outside accesses directly based on UIAPI.
   */
  public update = (type:uProxy.Update, data?:any) => {
    switch(type) {
      case uProxy.Update.ALL:
        console.log('update [ALL]', store.state);
        // data = store.state;
        var networkName :string;
        for (networkName in Social.networks) {
          Social.networks[networkName].notifyUI();
        }
        break;

      case uProxy.Update.NETWORK:
        console.log('update [NETWORK]', <UI.NetworkMessage>data);
        break;

      case uProxy.Update.USER_SELF:
      case uProxy.Update.USER_FRIEND:
        console.log('update [USER]', <UI.UserMessage>data);
        break;

      // TODO: Implement the finer-grained Update messages.
      default:
        console.warn('Not yet implemented.');
        return;
    }
    bgAppPageChannel.emit('' + type, data);
  }

  public syncInstance = (instance, field?:any) => {
    // TODO: (the interface may change)
  }

  public syncMappings = () => {
    // TODO: (the interface may change)
  }

  public sync = () => {
    // TODO: (the interface may change)
    console.log('sending ALL state to UI.');
    ui.update(uProxy.Update.ALL);
  }

}
var ui = new UIConnector();

/**
 * Primary uProxy backend. Handles which social networks one is connected to,
 * sends updaes to the UI, and handles commands from the UI.
 */
module Core {

  /**
   * Logs out of all networks and resets data.
   */
  export var reset = () => {
    console.log('reset');
    for (var network in Social.networks) {
      Social.networks[network].logout();
    }
    store.reset().then(ui.sync);
  }

  /**
   * Install a handler for commands received from the UI.
   */
  export var onCommand = (cmd :uProxy.Command, handler:any) => {
    bgAppPageChannel.on('' + cmd, handler);
  }

  /**
   * Access various social networks using the Social API.
   * TODO: write a test for this.
   */
  export var login = (networkName:string, explicit:boolean=false) => {
    var network = Social.getNetwork(networkName);
    if (null === network) {
      console.warn('Could not login to ' + networkName);
      return;
    }
    network.login(true)
        .then(ui.sync)
        .then(() => {
          console.log('Successfully logged in to ' + networkName);
        });

    // TODO: save the auto-login default.
    store.saveMeToStorage();
  }

  /**
   * Log-out of |networkName|.
   * TODO: write a test for this.
   */
  export var logout = (networkName:string) : void => {
    var network = Social.getNetwork(networkName);
    if (null === network) {
      console.warn('Could not logout of ' + networkName);
      return;
    }
    network.logout().then(() => {
      console.log('Successfully logged out of ' + networkName);
    });
    // TODO: only remove clients from the network we are logging out of.
    // Clear the clientsToInstance table.
    store.state.clientToInstance = {};
    store.state.instanceToClient = {};
    ui.syncMappings();
    // TODO: disable auto-login
    store.saveMeToStorage();
  }

  // Send consent bits to re-synchronize consent with remote |instance|.
  // This happens *after* receiving an instance notification for an instance which
  // we already have a history with.
  // TODO: Move this into the Instance class.
  export var sendConsent = (instance:Instance) => {
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
  export var receiveConsent = (msg:any) => {
    if (! (msg.fromUserId in store.state.roster)) {
      console.error('msg.fromUserId (' + msg.fromUserId +
                    ') is not in the roster');
    }
    var theirConsent = msg.data.consent,      // Their view of consent.
        instanceId   = msg.data.instanceId,   // InstanceId of the sender.
        instance     = store.getInstance(instanceId);
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
    ui.syncInstance(instance, 'trust');
    return true;
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
var defaultNetwork = networks['websocket']['api'];


// --------------------------------------------------------------------------
// Signalling channel hooks.
// --------------------------------------------------------------------------
// peerId is a client ID.
client.on('sendSignalToPeer', (data:PeerSignal) => {
    console.log('client(sendSignalToPeer):' + JSON.stringify(data) +
                ', sending to client: ' + data.peerId + ', which should map to instance: ' +
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
  ui.syncInstance(instance, 'status');

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

  client.emit('stop');
  instance.status.proxy = C.ProxyState.OFF;
  ui.syncInstance(instance, 'status');

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

// TODO: move this into User, or some sort of proxy service object.
function handleNewlyActiveClient(msg) {
  var instanceId = msg.data.instanceId;
  var instance = store.state.instances[instanceId];
  if (!instance) {
    console.error('Cannot be proxy for nonexistent instance.');
    return;
  }
  console.log('PROXYING FOR CLIENT INSTANCE: ' + instanceId);
  instance.status.client = C.ProxyState.RUNNING;
  ui.syncInstance(instance, 'status');
}

function handleInactiveClient(msg) {
  var instanceId = msg.data.instanceId;
  var instance = store.state.instances[instanceId];
  if (!instance) {
    console.error('Cannot be proxy for nonexistent instance.');
    return;
  }
  instance.status.client = C.ProxyState.OFF;
  ui.syncInstance(instance, 'status');
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
  ui.syncInstance(instance, 'trust');
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

// For each direction (e.g., I proxy for you, or you proxy for me), there
// is a logical AND of consent from both parties. If the local state for
// trusting them to be a proxy (trust.asProxy) is Yes or Requested, we
// consent to being their client. If the local state for trusting them to
// be our client is Yes or Offered, we consent to being their proxy.
function _determineConsent(trust) {
  return { asProxy:  [C.Trust.YES, C.Trust.OFFERED].indexOf(trust.asClient) >= 0,
           asClient: [C.Trust.YES, C.Trust.REQUESTED].indexOf(trust.asProxy) >= 0 };
}

function _composeTrustFromConsent(myConsent, theirConsent) : InstanceTrust {
  return {
      asProxy: theirConsent.asProxy?
          (myConsent.asClient? C.Trust.YES : C.Trust.OFFERED) :
          (myConsent.asClient? C.Trust.REQUESTED : C.Trust.NO),
      asClient: theirConsent.asClient?
          (myConsent.asProxy? C.Trust.YES : C.Trust.REQUESTED) :
          (myConsent.asProxy? C.Trust.OFFERED : C.Trust.NO)
  };
}

function _validateKeyHash(keyHash:string) {
  console.log('Warning: keyHash Validation not yet implemented...');
  return true;
}

// Set notification flag for Instance corresponding to |instanceId|, and also
// set the notification flag for the userId.
function _addNotification(instanceId:string) {
  var instance = store.getInstance(instanceId);
  if (!instance) {
    console.error('Could not find instance ' + instanceId);
    return false;
  }
  instance.notify = true;
  store.saveInstance(instanceId);
  ui.syncInstance(instance, 'notify');
}

// Remove notification flag for Instance corresponding to |instanceId|, if it
// exists.
function _removeNotification(instanceId:string) {
  if (!instanceId) return;

  var instance = store.getInstance(instanceId);
  if (!instance) {
    console.error('Instance does not exist for ' + instanceId);
    return false;
  }
  instance.notify = false;
  store.saveInstance(instanceId);
  ui.syncInstance(instance, 'notify');
  return true;
}

/**
 * Update the description for an instanceId.
 * Assumes that |instanceId| is valid.
 */
function receiveUpdateDescription(msg) {
  console.log('Updating description! ' + JSON.stringify(msg));
  var description = msg.data.description,
      instanceId = msg.data.instanceId,
      instance = store.getInstance(instanceId);
  if (!instance) {
    console.error('Could not update description - no instance: ' + instanceId);
    return false;
  }
  instance.description = description;
  ui.syncInstance(instance, 'description');
  return true;
}


// --------------------------------------------------------------------------
// Register Core responses to UI commands.
// --------------------------------------------------------------------------
Core.onCommand(uProxy.Command.READY, ui.sync);
Core.onCommand(uProxy.Command.RESET, Core.reset);
// When the login message is sent from the extension, assume it's explicit.
Core.onCommand(uProxy.Command.LOGIN, (network) => { Core.login(network, true); });
Core.onCommand(uProxy.Command.LOGOUT, Core.logout)

// TODO: UI-initiated Instance Handshakes need to be made specific to a network.
// Core.onCommand(uProxy.Command.SEND_INSTANCE, Core.sendInstance);
Core.onCommand(uProxy.Command.MODIFY_CONSENT, Core.modifyConsent);

Core.onCommand(uProxy.Command.START_PROXYING, startUsingPeerAsProxyServer);
Core.onCommand(uProxy.Command.STOP_PROXYING, stopUsingPeerAsProxyServer);

Core.onCommand(uProxy.Command.CHANGE_OPTION, (data) => {
  store.state.options[data.key] = data.value;
  store.saveOptionsToStorage().then(() => {;
    console.log('saved options ' + JSON.stringify(store.state.options));
    // TODO: Make this fine-grained for just the Option.
    ui.sync();
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
