/**
 * core.ts
 *
 * This is the primary uproxy code. It maintains in-memory state,
 * checkpoints information to local storage, and synchronizes state with the
 * front-end.
 *
 * In-memory state includes:
 *  - Roster, which is a list of contacts, always synced with XMPP friend lists.
 *  - Instances, which is a list of active uProxy installs.
 */
/// <reference path='../uproxy.ts'/>
/// <reference path='storage.ts' />
/// <reference path='social.ts' />
/// <reference path='util.ts' />
/// <reference path='../interfaces/instance.d.ts' />
/// <reference path='../interfaces/ui.d.ts' />
// TODO: Create a copy rule which automatically moves all third_party
// typescript declarations to a nicer path.
/// <reference path='../freedom/typings/freedom.d.ts' />
/// <reference path='../freedom/typings/social.d.ts' />
/// <reference path='../networking-typings/communications.d.ts' />


var storage = new Core.Storage();

// This is the channel to speak to the UI component of uProxy.
// The UI is running from the privileged part of freedom, so we can just set
// this to be freedom, and communicate using 'emit's and 'on's.
var bgAppPageChannel = new freedom();

// Keep track of the current remote instance who is acting as a proxy server
// for us.
var remoteProxyInstance : Core.RemoteInstance = null;

// Entry-point into the UI.
class UIConnector implements uProxy.UIAPI {

  /**
   * Send an Update message to the UI.
   * TODO: Turn this private and make outside accesses directly based on UIAPI.
   */
  public update = (type:uProxy.Update, data?:any) => {
    var printableType :string = uProxy.Update[type];
    console.log('update [' + printableType + ']', data);
    bgAppPageChannel.emit('' + type, data);
  }

  public sendInitialState = () => {
    // Only send update to UI when global settings have loaded.
    core.loadGlobalSettings.then(() => {
      this.update(
          uProxy.Update.INITIAL_STATE,
          {
            networkNames: Object.keys(Social.networks),
            globalSettings: core.globalSettings
          });
    });
  }

  public syncUser = (payload:UI.UserMessage) => {
    console.log('Core: UI.syncUser ' + JSON.stringify(payload));
    this.update(uProxy.Update.USER_FRIEND, payload);
  }

  public sendError = (errorText :string) => {
    this.update(uProxy.Update.ERROR, errorText);
  }

  public showNotification = (notificationText :string) => {
    this.update(uProxy.Update.NOTIFICATION, notificationText);
  }

}
var ui = new UIConnector();

/**
 * Primary uProxy backend. Handles which social networks one is connected to,
 * sends updates to the UI, and handles commands from the UI.
 */
class uProxyCore implements uProxy.CoreAPI {
  private DEFAULT_STUN_SERVERS_ = [{urls: ['stun:stun.l.google.com:19302']},
                                {urls: ['stun:stun1.l.google.com:19302']},
                                {urls: ['stun:stun2.l.google.com:19302']},
                                {urls: ['stun:stun3.l.google.com:19302']},
                                {urls: ['stun:stun4.l.google.com:19302']}];

  // Initially, the STUN servers are a copy of the default.
  // We need to use slice to copy the values, otherwise modifying this
  // variable can modify DEFAULT_STUN_SERVERS_ as well.
  public globalSettings :Core.GlobalSettings
      = {description: '',
         stunServers: this.DEFAULT_STUN_SERVERS_.slice(0),
         hasSeenSharingEnabledScreen: false,
         hasSeenWelcome: false};
  public loadGlobalSettings :Promise<void> = null;

  constructor() {
    console.log('Preparing uProxy Core.');
    // Send the local webrtc fingerprint to the UI.
    // TODO: enable once we can use peerconnection from within the webworker.
    Auth.getLocalFingerprint().then((fingerprint) => {
      console.log('Fetched local WebRTC fingerprint: ' + fingerprint);
      ui.update(uProxy.Update.LOCAL_FINGERPRINT, fingerprint);
    }).catch((e) => {
      console.error(e);
    });

    this.loadGlobalSettings = storage.load<Core.GlobalSettings>('globalSettings')
        .then((globalSettingsObj :Core.GlobalSettings) => {
          console.log('Loaded global settings: ' + JSON.stringify(globalSettingsObj));
          this.globalSettings = globalSettingsObj;
          // If no custom STUN servers were found in storage, use the default
          // servers.
          if (!this.globalSettings.stunServers
              || this.globalSettings.stunServers.length == 0) {
            this.globalSettings.stunServers = this.DEFAULT_STUN_SERVERS_.slice(0);
          }
          // If storage does not know if this user has seen a specific overlay
          // yet, assume the user has not seen it so that they will not miss any
          // onboarding information.
          if (this.globalSettings.hasSeenSharingEnabledScreen == null) {
            this.globalSettings.hasSeenSharingEnabledScreen = false;
          }
          if (this.globalSettings.hasSeenWelcome == null) {
            this.globalSettings.hasSeenWelcome = false;
          }
        }).catch((e) => {
          console.log('No global settings loaded', e);
        });
  }

  // sendInstanceHandshakeMessage = (clientId :string) => {
  //   // TODO: Possibly implement this, or get rid of the possibility for
  //   // UI-initiated instance handshakes.
  // }

  /**
   * Install a handler for commands received from the UI.
   */
  public onCommand = (cmd :uProxy.Command, handler:any) => {
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
  public onPromiseCommand = (cmd :uProxy.Command,
                             handler :(data ?:any) => Promise<any>) => {
    var promiseCommandHandler = (args :uProxy.PromiseCommand) => {
      // Ensure promiseId is set for all requests
      if (!args.promiseId) {
        var err = 'onPromiseCommand called for cmd ' + cmd +
                  'with promiseId undefined';
        console.error(err)
        return Promise.reject(err);
      }

      // Call handler function, then return success or failure to UI.
      handler(args.data).then(
        (argsForCallback ?:any) => {
          ui.update(uProxy.Update.COMMAND_FULFILLED,
              { promiseId: args.promiseId,
                argsForCallback: argsForCallback });
        },
        (errorForCallback :Error) => {
          ui.update(uProxy.Update.COMMAND_REJECTED,
              { promiseId: args.promiseId,
                errorForCallback: errorForCallback });
        }
      );
    };
    bgAppPageChannel.on('' + cmd, promiseCommandHandler);
  }

  changeOption = (option :string) => {
    // TODO: implement options.
  }

  dismissNotification = (instancePath :InstancePath) => {
    // TODO: implement options.
  }


  /**
   * Access various social networks using the Social API.
   */
  public login = (networkName :string) : Promise<void> => {
    if (networkName === Social.MANUAL_NETWORK_ID) {
      var network = Social.getNetwork(networkName, '');
      var loginPromise = network.login(true);
      loginPromise.then(() => {
        Social.notifyUI(networkName);
        console.log('Logged in to manual network');
      });
      return loginPromise;
    }

    if (!(networkName in Social.networks)) {
      var warn = 'Network ' + networkName + ' does not exist.';
      console.warn(warn)
      return Promise.reject(warn);
    }
    var network = Social.pendingNetworks[networkName];
    if (typeof network === 'undefined') {
      network = new Social.FreedomNetwork(networkName);
      Social.pendingNetworks[networkName] = network;
    }
    var loginPromise = network.login(true);
    loginPromise.then(() => {
          var userId = network.myInstance.userId;
          if (userId in Social.networks[networkName]) {
            // If user is already logged in with the same (network, userId)
            // log out from existing network before replacing it.
            Social.networks[networkName][userId].logout();
          }
          Social.networks[networkName][userId] = network;
          delete Social.pendingNetworks[networkName];
          console.log('Successfully logged in to ' + networkName +
                      ' with user id ' + userId);
        }).catch(() => {
          delete Social.pendingNetworks[networkName];
        });

    // TODO: save the auto-login default.
    return loginPromise;
  }

  /**
   * Log-out of |networkName|.
   * TODO: write a test for this.
   */
  public logout = (networkInfo :NetworkInfo) : Promise<void> => {
    var networkName = networkInfo.name;
    var userId = networkInfo.userId;
    var network = Social.getNetwork(networkName, userId);
    if (null === network) {
      console.warn('Could not logout of network ', networkName);
      return;
    }
    return network.logout().then(() => {
      console.log('Successfully logged out of ' + networkName);
    });
    // TODO: disable auto-login
    // store.saveMeToStorage();
  }

  // onUpdate not needed in the real core.
  onUpdate = (update, handler) => {}

  /**
   * Updates user's description of their current device. This applies to all
   * local instances for every network the user is currently logged onto. Those
   * local instances will then propogate their description update to all
   * instances.
   */

  public updateGlobalSettings = (newSettings:Core.GlobalSettings) => {
    storage.save<Core.GlobalSettings>('globalSettings', newSettings);

    // Clear the existing servers and add in each new server.
    // Trying globalSettings = newSettings does not correctly update
    // pre-existing references to stunServers (e.g. from RemoteInstances).
    this.globalSettings.stunServers
        .splice(0, this.globalSettings.stunServers.length);
    for (var i = 0; i < newSettings.stunServers.length; ++i) {
      this.globalSettings.stunServers.push(newSettings.stunServers[i]);
    }

    if (newSettings.description != this.globalSettings.description) {
      this.globalSettings.description = newSettings.description;
      // Resend instance info to update description for logged in networks.
      for (var networkName in Social.networks) {
        for (var userId in Social.networks[networkName]) {
          Social.networks[networkName][userId].resendInstanceHandshakes();
        }
      }
    }

    this.globalSettings.hasSeenSharingEnabledScreen =
        newSettings.hasSeenSharingEnabledScreen;
    this.globalSettings.hasSeenWelcome = newSettings.hasSeenWelcome;
  }

  /**
   * Modifies the local consent value as the result of a local user action.
   * This is a distinct pathway from receiving consent bits over the wire, which
   * is handled directly inside the relevant Social.Network.
   */
  public modifyConsent = (command:uProxy.ConsentCommand) => {
    // Determine which Network, User, and Instance...
    var instance = this.getInstance(command.path);
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
  public start = (path :InstancePath) : Promise<Net.Endpoint> => {
    // Disable any previous proxying session.
    if (remoteProxyInstance) {
      console.log('Existing proxying session! Terminating...');
      // Stop proxy, don't notify UI since UI request a new proxy.
      remoteProxyInstance.stop();
      remoteProxyInstance = null;
    }
    var remote = this.getInstance(path);
    if (!remote) {
      var err = 'Instance ' + path.instanceId + ' does not exist for proxying.';
      console.error(err);
      return Promise.reject(err);
    }
    // Remember this instance as our proxy.  Set this before start fulfills
    // in case the user decides to cancel the proxy before it begins.
    remoteProxyInstance = remote;
    return remote.start().then((endpoint:Net.Endpoint) => {
      // remote.start will send an update to the UI.
      return endpoint;
    }).catch((e) => {
      remoteProxyInstance = null;
      return Promise.reject('Error starting proxy');
    });
  }

  /**
   * Stop proxying with the current instance, if it exists.
   */
  public stop = () => {
    if (!remoteProxyInstance) {
      console.error('Cannot stop proxying when there is no proxy');
      return;
    }
    remoteProxyInstance.stop();
    remoteProxyInstance = null;
    // TODO: Handle revoked permissions notifications.
  }

  public handleManualNetworkInboundMessage =
      (command :uProxy.HandleManualNetworkInboundMessageCommand) => {
    var manualNetwork :Social.ManualNetwork =
        <Social.ManualNetwork> Social.getNetwork(Social.MANUAL_NETWORK_ID, '');
    if (!manualNetwork) {
      console.error('Manual network does not exist; discarding inbound ' +
                    'message. Command=' + JSON.stringify(command));
      return;
    }

    manualNetwork.receive(command.senderClientId, command.message);
  }

  /**
   * Obtain the RemoteInstance corresponding to an instance path.
   */
  public getInstance = (path :InstancePath) : Core.RemoteInstance => {
    var network = Social.getNetwork(path.network.name, path.network.userId);
    if (!network) {
      console.error('No network ' + path.network.name);
      return;
    }
    var user = network.getUser(path.userId);
    if (!user) {
      console.error('No user ' + path.userId);
      return;
    }
    return user.getInstance(path.instanceId);
  }
}  // class uProxyCore


// Prepare all the social providers from the manifest.
Social.initializeNetworks();
var core = new uProxyCore();


function _validateKeyHash(keyHash:string) {
  console.log('Warning: keyHash Validation not yet implemented...');
  return true;
}

// --------------------------------------------------------------------------
// Register Core responses to UI commands.
// --------------------------------------------------------------------------
core.onCommand(uProxy.Command.GET_INITIAL_STATE, ui.sendInitialState);
// When the login message is sent from the extension, assume it's explicit.
core.onPromiseCommand(uProxy.Command.LOGIN, core.login);
core.onPromiseCommand(uProxy.Command.LOGOUT, core.logout)

// TODO: UI-initiated Instance Handshakes need to be made specific to a network.
// core.onCommand(uProxy.Command.SEND_INSTANCE_HANDSHAKE_MESSAGE,
//                core.sendInstanceHandshakeMessage);
core.onCommand(uProxy.Command.MODIFY_CONSENT, core.modifyConsent);

core.onPromiseCommand(uProxy.Command.START_PROXYING, core.start);
core.onCommand(uProxy.Command.STOP_PROXYING, core.stop);

// TODO: Implement this or remove it.
// core.onCommand(uProxy.Command.CHANGE_OPTION, (data) => {
//   console.warn('CHANGE_OPTION yet to be implemented!');
//   // TODO: Handle changes that might affect proxying.
// });

// TODO: make the invite mechanism an actual process.
// core.onCommand(uProxy.Command.INVITE, (userId:string) => {
// });

core.onCommand(uProxy.Command.HANDLE_MANUAL_NETWORK_INBOUND_MESSAGE,
               core.handleManualNetworkInboundMessage);
core.onCommand(uProxy.Command.UPDATE_GLOBAL_SETTINGS, core.updateGlobalSettings);

// Now that this module has got itself setup, it sends a 'ready' message to the
// freedom background page.
bgAppPageChannel.emit('ready', null);
