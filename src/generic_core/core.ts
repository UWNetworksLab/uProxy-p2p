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
/// <reference path='storage.ts' />
/// <reference path='social.ts' />
/// <reference path='util.ts' />
/// <reference path='../interfaces/instance.d.ts' />
/// <reference path='../interfaces/ui.d.ts' />
// TODO: Create a copy rule which automatically moves all third_party
// typescript declarations to a nicer path.
/// <reference path='../../node_modules/freedom-typescript-api/interfaces/freedom.d.ts' />
/// <reference path='../../node_modules/freedom-typescript-api/interfaces/social.d.ts' />
/// <reference path='../../node_modules/socks-rtc/src/interfaces/communications.d.ts' />

var storage = new Core.Storage();  // From start-uproxy.ts.

// This is the channel to speak to the UI component of uProxy.
// The UI is running from the privileged part of freedom, so we can just set
// this to be freedom, and communicate using 'emit's and 'on's.
var bgAppPageChannel = freedom;

// The socks-rtc client and server allows us to proxy through / for other uProxy
// peers. See [https://github.com/uProxy/socks-rtc] for more information.
var socksToRtcClient = freedom['SocksToRtc']();
var rtcToNetServer = freedom['RtcToNet']();
// The Core's responsibility is to pass messages across the signalling
// channel using the User / Instance mechanisms.

// Keep track of the current remote proxy, if they exist.
var proxy :Core.RemoteInstance = null;

// Entry-point into the UI.
class UIConnector implements uProxy.UIAPI {

  /**
   * Send an Update message to the UI.
   * TODO: Turn this private and make outside accesses directly based on UIAPI.
   */
  public update = (type:uProxy.Update, data?:any) => {
    switch(type) {
      case uProxy.Update.ALL:
        // console.log('update [ALL]', store.state);
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

      case uProxy.Update.COMMAND_FULFILLED:
        console.log('update [COMMAND_FULFILLED]', <number>data);
        break;

      case uProxy.Update.COMMAND_REJECTED:
        console.log('update [COMMAND_REJECTED]', <number>data);
        break;

      // TODO: re-enable once the CLIENT-specific messages work.
      // case uProxy.Update.CLIENT:
        // console.log('update [CLIENT]', <UI.ClientMessage>data);
        // break;

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

  public syncUser = (payload:UI.UserMessage) => {
    console.log('Core: UI.syncUser ' + JSON.stringify(payload));
    this.update(uProxy.Update.USER_FRIEND, payload);
  }

  public refreshDOM = () => {
    console.error('Cannot refresh DOM from the Core.');
  };

}
var ui = new UIConnector();

/**
 * Primary uProxy backend. Handles which social networks one is connected to,
 * sends updaes to the UI, and handles commands from the UI.
 * TODO: Convert this into a class, actually implementing the CoreAPI.
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
    storage.reset().then(ui.sync);
  }

  /**
   * Install a handler for commands received from the UI.
   */
  export var onCommand = (cmd :uProxy.Command, handler:any) => {
    bgAppPageChannel.on('' + cmd,
      (args :uProxy.PromiseCommand) => {
        // Call handler with args.data and ignore other fields in args
        // like promiseId.
        handler(args.data);
      });
  }

  /**
   * Install a handler for promise commands received from the UI.
   * Promise commands return an ack or error to the UI.
   */
  export var onPromiseCommand = (cmd :uProxy.Command,
                                 handler :(data ?:any) => Promise<void>) => {
    var promiseCommandHandler = (args :uProxy.PromiseCommand) => {
      // Ensure promiseId is set for all requests
      if (!args.promiseId) {
        console.error('onPromiseCommand called for cmd ' + cmd +
                      'with promiseId undefined');
        return Promise.reject();
      }

      // Call handler function, then return success or failure to UI.
      handler(args.data).then(
        () => {
          ui.update(uProxy.Update.COMMAND_FULFILLED, args.promiseId);
        },
        () => {
          ui.update(uProxy.Update.COMMAND_REJECTED, args.promiseId);
        }
      );
    };
    bgAppPageChannel.on('' + cmd, promiseCommandHandler);
  }

  /**
   * Access various social networks using the Social API.
   * TODO: write a test for this.
   */
  export var login = (networkName:string) : Promise<void> => {
    var network = Social.getNetwork(networkName);
    if (null === network) {
      console.warn('Could not login to ' + networkName);
      return Promise.reject();
    }
    var loginPromise = network.login(true);
    loginPromise.then(ui.sync)
        .then(() => {
          console.log('Successfully logged in to ' + networkName);
        });

    // TODO: save the auto-login default.
    return loginPromise;
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
    ui.syncMappings();
    // TODO: disable auto-login
    // store.saveMeToStorage();
  }

  /**
   * Update user's description of their current device. This applies to all
   * local instances for every network the user is currently logged onto. Those
   * local instances will then propogate their description update to all
   * instances.
   */
  export var updateDescription = (description:string) => {
    for (var network in Social.networks) {
      var myself = Social.networks[network].getLocalInstance();
      if (!myself) {
        console.error('No LocalInstance to set description for!');
        return;
      }
      myself.updateDescription(description);
    }
  }

  /**
   * Modifies the local consent value as the result of a local user action.
   * This is a distinct pathway from receiving consent bits over the wire, which
   * is handled directly inside the relevant Social.Network.
   */
  export var modifyConsent = (command:uProxy.ConsentCommand) => {
    // Determine which Network, User, and Instance...
    var instance = getInstance(command.path);
    if (!instance) {  // Error msg emitted above.
      console.error('Cannot modify consent for non-existing instance!');
      return;
    }
    // Set the instance's new consent levels. It will take care of sending new
    // consent bits over the wire and re-syncing with the UI.
    instance.modifyConsent(command.action);
  }

  /**
   * Begin using a peer as a proxy server.
   * Starts SDP negotiations with a remote peer. Assumes |path| to the
   * RemoteInstance exists.
   */
  export var start = (path :InstancePath) : Promise<void> => {
    // Disable any previous proxying session.
    if (proxy) {
      console.log('Existing proxying session! Terminating...');
      stop();
      proxy = null;
    }
    var remote = getInstance(path);
    if (!remote) {
      console.error('Instance ' + path.instanceId +
                    ' does not exist for proxying.');
      return Promise.reject();
    }
    // remote.start will send an update to the UI.
    return remote.start().then(() => {
      // Remember this instance as our proxy.
      proxy = remote;
    });
  }

  /**
   * Stop proxying with the current instance, if it exists.
   */
  export var stop = () => {
    if (!proxy) {
      console.error('Cannot stop proxying when there is no proxy');
    }
    proxy.stop();
    proxy = null;
    // TODO: Handle revoked permissions notifications.
  }

  /**
   * Obtain the RemoteInstance corresponding to an instance path.
   */
  export var getInstance = (path :InstancePath) : Core.RemoteInstance => {
    var network = Social.getNetwork(path.network);
    if (!network) {
      console.error('No network ' + path.network);
      return;
    }
    var user = network.getUser(path.userId);
    if (!user) {
      console.error('No user ' + path.userId);
      return;
    }
    return user.getInstance(path.instanceId);
  }

}  // module Core

// Prepare all the social providers from the manifest.
var networks = Social.initializeNetworks();

/*

Install signalling channel hooks. When we receive 'sendSignalToPeer' events
emitted from the socks-rtc, it is uProxy's job to pass those signals through to
XMPP / the target social provider, eventually reaching the appropriate remote
instance. To accomplish this, it must identify the peer using a fully qualified
InstancePath.

The data sent over the signalling channel will be the full signal, and not just
the data portion. This includes the |peerId| as part of the payload, which will
allow the remote to verify the provinance of the signal.

:PeerSignal is defined in SocksRTC.
Expect peerId to be a #-connected InstancePath.

*/
socksToRtcClient.on('sendSignalToPeer', (signalFromSocksRtc :PeerSignal) => {
  console.log('client(sendSignalToPeer):' + JSON.stringify(signalFromSocksRtc));

  var localPeerId :LocalPeerId = JSON.parse(signalFromSocksRtc.peerId);
  var instance = Core.getInstance(localPeerId.serverInstancePath);
  if (!instance) {
    console.error('Cannot send client signal to non-existing RemoteInstance.');
    return;
  }

  // When passing the PeerSignal over the social network, the signal's peerId
  // should only contain instance ids, not potentially revealing user or
  // social network info.
  var localInstanceId = instance.user.getLocalInstanceId();
  var sharedSignal :PeerSignal = {
    peerId: localInstanceId,
    data: signalFromSocksRtc.data
  };
  console.log('client(sendSignalToPeer): sending sharedSignal ' +
              JSON.stringify(sharedSignal));
  instance.send({
    type: uProxy.MessageType.SIGNAL_FROM_CLIENT_PEER,
    data: sharedSignal
  });
});

socksToRtcClient.on('socksToRtcSuccess', (peerInfo :PeerInfo) => {
  var localPeerId :LocalPeerId = JSON.parse(peerInfo.peerId);
  var instance = Core.getInstance(localPeerId.serverInstancePath);
  if (!instance) {
    console.error('socksToRtcSuccess: RemoteInstance not found.', peerInfo);
    return;
  }
  instance.handleStartSuccess();
});

socksToRtcClient.on('socksToRtcFailure', (peerInfo :PeerInfo) => {
  var localPeerId :LocalPeerId = JSON.parse(peerInfo.peerId);
  var instance = Core.getInstance(localPeerId.serverInstancePath);
  if (!instance) {
    console.error('socksToRtcFailure: RemoteInstance not found.', peerInfo);
    return;
  }
  instance.handleStartFailure();
});

// Make this take an actual peer object type.
rtcToNetServer.on('sendSignalToPeer', (signalFromSocksRtc :PeerSignal) => {
  console.log('server(sendSignalToPeer):' + JSON.stringify(signalFromSocksRtc));

  var localPeerId :LocalPeerId = JSON.parse(signalFromSocksRtc.peerId);
  var instance = Core.getInstance(localPeerId.clientInstancePath);
  if (!instance) {
    console.error('Cannot send server signal to non-existing peer.');
    return;
  }

  // When passing the PeerSignal over the social network, the signal's peerId
  // should only contain instance ids, not potentially revealing user or
  // social network info.
  var localInstanceId = instance.user.getLocalInstanceId();
  var sharedSignal :PeerSignal = {
    peerId: localInstanceId,
    data: signalFromSocksRtc.data
  };
  console.log('server(sendSignalToPeer): sending sharedSignal ' +
              JSON.stringify(sharedSignal));
  instance.send({
    type: uProxy.MessageType.SIGNAL_FROM_SERVER_PEER,
    data: sharedSignal
  });
});

function updateClientProxyConnection(localPeerIdString :string,
    isConnected :boolean) {
  var localPeerId :LocalPeerId = JSON.parse(localPeerIdString);
  var instance = Core.getInstance(localPeerId.clientInstancePath);
  if (!instance) {
    console.error('updateClientProxyConnection: RemoteInstance not found.',
        localPeerIdString, isConnected);
    return;
  }
  instance.updateClientProxyConnection(isConnected);
};

rtcToNetServer.on('rtcToNetConnectionEstablished',
  (localPeerIdString :string) => {
  updateClientProxyConnection(localPeerIdString, true);
});

rtcToNetServer.on('rtcToNetConnectionClosed',
  (localPeerIdString :string) => {
  console.log('got rtcToNetConnectionClosed event!!!');
  updateClientProxyConnection(localPeerIdString, false);
});

// TODO: move this into User, or some sort of proxy service object.
/*
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
*/

function _validateKeyHash(keyHash:string) {
  console.log('Warning: keyHash Validation not yet implemented...');
  return true;
}

// TODO: Move notifications into its own service.
// Set notification flag for Instance corresponding to |instanceId|, and also
// set the notification flag for the userId.
/*
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
*/

/**
 * Update the description for an instanceId.
 * Assumes that |instanceId| is valid.
 * TODO: Move this into LocalInstance.
 */
/*
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
*/

// --------------------------------------------------------------------------
// Register Core responses to UI commands.
// --------------------------------------------------------------------------
Core.onCommand(uProxy.Command.READY, ui.sync);
Core.onCommand(uProxy.Command.RESET, Core.reset);
// When the login message is sent from the extension, assume it's explicit.
Core.onPromiseCommand(uProxy.Command.LOGIN, Core.login);
Core.onCommand(uProxy.Command.LOGOUT, Core.logout)

// TODO: UI-initiated Instance Handshakes need to be made specific to a network.
// Core.onCommand(uProxy.Command.SEND_INSTANCE, Core.sendInstance);
Core.onCommand(uProxy.Command.MODIFY_CONSENT, Core.modifyConsent);

Core.onPromiseCommand(uProxy.Command.START_PROXYING, Core.start);
Core.onCommand(uProxy.Command.STOP_PROXYING, Core.stop);

Core.onCommand(uProxy.Command.CHANGE_OPTION, (data) => {
  console.warn('CHANGE_OPTION yet to be implemented!');
  // TODO: Handle changes that might affect proxying.
});

Core.onCommand(uProxy.Command.UPDATE_DESCRIPTION, Core.updateDescription);
Core.onCommand(uProxy.Command.DISMISS_NOTIFICATION, (userId) => {
  // TODO: Implement an actual notifications/userlog pipeline.
  /*
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
  */
  // Don't need to re-sync with UI - expect UI to have done the change.
});

// TODO: make the invite mechanism an actual process.
Core.onCommand(uProxy.Command.INVITE, (userId:string) => {
});
