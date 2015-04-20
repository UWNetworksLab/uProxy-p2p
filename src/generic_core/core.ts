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
/// <reference path='diagnose.ts' />
/// <reference path='../interfaces/instance.d.ts' />
// TODO: Create a copy rule which automatically moves all third_party
// typescript declarations to a nicer path.
/// <reference path='../freedom/typings/freedom.d.ts' />
/// <reference path='../freedom/typings/social.d.ts' />
/// <reference path='../networking-typings/communications.d.ts' />

// Note that the proxy runs extremely slowly in debug ('*:D') mode.
var loggingProvider = freedom['loggingprovider']();
loggingProvider.setConsoleFilter(['*:I']);
loggingProvider.setBufferedLogFilter(['*:D']);

declare var UPROXY_VERSION;

var log :Logging.Log = new Logging.Log('core');
log.info('Loading core', UPROXY_VERSION);

var storage = new Core.Storage();

// This is the channel to speak to the UI component of uProxy.
// The UI is running from the privileged part of freedom, so we can just set
// this to be freedom, and communicate using 'emit's and 'on's.
var bgAppPageChannel = freedom();

// Keep track of the current remote instance who is acting as a proxy server
// for us.
var remoteProxyInstance : Core.RemoteInstance = null;

// This is a global instance of RemoteConnection that is currently used for
// either sharing or using a proxy through the copy+paste interface (i.e.
// without an instance)
var copyPasteConnection : Core.RemoteConnection = null;

// Entry-point into the UI.
class UIConnector implements uProxy.UIAPI {

  /**
   * Send an Update message to the UI.
   * TODO: Turn this private and make outside accesses directly based on UIAPI.
   */
  public update = (type:uProxy.Update, data?:any) => {
    var printableType :string = uProxy.Update[type];
    if (type == uProxy.Update.COMMAND_FULFILLED
        && data['command'] == uProxy.Command.GET_LOGS){
      log.debug('sending logs to UI', {
        type: printableType,
        data: 'logs not printed to prevent duplication if logs are sent again.'
      });
    } else {
      log.debug('sending message to UI', {
        type: printableType,
        data: data
      });
    }
    bgAppPageChannel.emit('' + type, data);
  }

  public sendInitialState = () => {
    // Only send update to UI when global settings have loaded.
    core.loadGlobalSettings.then(() => {
      this.update(
          uProxy.Update.INITIAL_STATE,
          {
            networkNames: Object.keys(Social.networks),
            globalSettings: core.globalSettings,
            onlineNetwork: Social.getOnlineNetwork()
          });
    });
  }

  public syncUser = (payload:UI.UserMessage) => {
    this.update(uProxy.Update.USER_FRIEND, payload);
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
         hasSeenWelcome: false,
         allowNonUnicast: false,
         mode: uProxy.Mode.GET,
         version: uProxy.STORAGE_VERSION};
  public loadGlobalSettings :Promise<void> = null;
  private natType_ :String = '';

  constructor() {
    log.debug('Preparing uProxy Core');
    copyPasteConnection = new Core.RemoteConnection(ui.update);

    this.loadGlobalSettings = storage.load<Core.GlobalSettings>('globalSettings')
        .then((globalSettingsObj :Core.GlobalSettings) => {
          log.info('Loaded global settings', globalSettingsObj);
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
          if (this.globalSettings.allowNonUnicast == null) {
            this.globalSettings.allowNonUnicast = false;
          }
          if (typeof this.globalSettings.mode == 'undefined') {
            this.globalSettings.mode = uProxy.Mode.GET;
          }
        }).catch((e) => {
          log.info('No global settings loaded', e.message);
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
        log.error(err);
        return Promise.reject(new Error(err));
      }

      // Call handler function, then return success or failure to UI.
      handler(args.data).then(
        (argsForCallback ?:any) => {
          ui.update(uProxy.Update.COMMAND_FULFILLED,
              { command: cmd,
                promiseId: args.promiseId,
                argsForCallback: argsForCallback });
        },
        (errorForCallback :Error) => {
          var rejectionData = {
            promiseId: args.promiseId,
            errorForCallback: errorForCallback.toString()
          };
          ui.update(uProxy.Update.COMMAND_REJECTED, rejectionData);
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
        log.info('Logged in to manual network');
      });
      return loginPromise;
    }

    if (!(networkName in Social.networks)) {
      log.warn('Network does not exist', networkName);
      return Promise.reject(new Error('Network does not exist (' + networkName + ')'));
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
      log.info('Successfully logged in to network', {
        network: networkName,
        userId: userId
      });
    }).catch((e) => {
      log.error('Could not log in to network', e.stack);
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
      log.warn('Could not logout of network', networkName);
      return;
    }
    return network.logout().then(() => {
      log.info('Successfully logged out of network', networkName);
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

  public updateGlobalSettings = (newSettings :Core.GlobalSettings) => {
    newSettings.version = uProxy.STORAGE_VERSION;
    storage.save<Core.GlobalSettings>('globalSettings', newSettings).catch((e) => {
      log.error('Could not save globalSettings to storage', e.stack);
    });

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
    this.globalSettings.allowNonUnicast = newSettings.allowNonUnicast;
    this.globalSettings.mode = newSettings.mode;
  }

  /**
   * Modifies the local consent value as the result of a local user action.
   * This is a distinct pathway from receiving consent bits over the wire, which
   * is handled directly inside the relevant Social.Network.
   */
  public modifyConsent = (command:uProxy.ConsentCommand) => {
    // Determine which Network, User, and Instance...
    var user = this.getUser(command.path);
    if (!user) {  // Error msg emitted above.
      log.error('Cannot modify consent for non-existing user', command.path);
      return;
    }
    // Set the instance's new consent levels. It will take care of sending new
    // consent bits over the wire and re-syncing with the UI.
    user.modifyConsent(command.action);
  }

  public startCopyPasteGet = () : Promise<Net.Endpoint> => {
    if (remoteProxyInstance) {
      log.warn('Existing proxying session, terminating');
      remoteProxyInstance.stop();
      remoteProxyInstance = null;
    }

    return copyPasteConnection.startGet();
  }

  public stopCopyPasteGet = () :Promise<void> => {
    return copyPasteConnection.stopGet();
  }

  public startCopyPasteShare = () => {
    copyPasteConnection.startShare();
  }

  public stopCopyPasteShare = () :Promise<void> => {
    return copyPasteConnection.stopShare();
  }

  public sendCopyPasteSignal = (signal :uProxy.Message) => {
    copyPasteConnection.handleSignal(signal);
  }

  /**
   * Begin using a peer as a proxy server.
   * Starts SDP negotiations with a remote peer. Assumes |path| to the
   * RemoteInstance exists.
   */
  public start = (path :InstancePath) : Promise<Net.Endpoint> => {
    // Disable any previous proxying session.
    var stoppedGetting :Promise<void>[] = [];
    if (remoteProxyInstance) {
      log.warn('Existing proxying session, terminating');
      // Stop proxy, don't notify UI since UI request a new proxy.
      stoppedGetting.push(remoteProxyInstance.stop());
      remoteProxyInstance = null;
    }

    if (GettingState.NONE !== copyPasteConnection.localGettingFromRemote) {
      log.warn('Existing proxying session, terminating');
      stoppedGetting.push(copyPasteConnection.stopGet());
    }

    return Promise.all(stoppedGetting).catch((e) => {
      // if there was an error stopping the old connection we still want to
      // connect with the new one, do not propogate this error
      log.error('Could not clean up old connections', e);
    }).then(() => {
      var remote = this.getInstance(path);
      if (!remote) {
        log.error('Instance does not exist for proxying', path.instanceId);
        return Promise.reject(new Error('Instance does not exist for proxying (' + path.instanceId + ')'));
      }
      // Remember this instance as our proxy.  Set this before start fulfills
      // in case the user decides to cancel the proxy before it begins.
      remoteProxyInstance = remote;
      return remote.start();
    }).catch((e) => {
      remoteProxyInstance = null; // make sure to clean up any state
      log.error('Could not start remote proxying session', e.stack);
      return Promise.reject(e);
    });
  }

  /**
   * Stop proxying with the current instance, if it exists.
   */
  public stop = () => {
    if (!remoteProxyInstance) {
      log.error('Cannot stop proxying when there is no proxy');
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
      log.error('Manual network does not exist, discanding inbound message',
                command);
      return;
    }

    manualNetwork.receive(command.senderClientId, command.message);
  }

  /**
   * Obtain the RemoteInstance corresponding to an instance path.
   */
  public getInstance = (path :InstancePath) : Core.RemoteInstance => {
    var user = this.getUser(path);
    if (!user) {
      log.error('No user', path.userId);
      return;
    }
    return user.getInstance(path.instanceId);
  }

  public getUser = (path :UserPath) : Core.User => {
    var network = Social.getNetwork(path.network.name, path.network.userId);
    if (!network) {
      log.error('No network', path.network.name);
      return;
    }
    return network.getUser(path.userId);
  }

  // If the user requests the NAT type while another NAT request is pending,
  // the then() block of doNatProvoking ends up being called twice.
  // We keep track of the timeout that resets the NAT type to make sure
  // there is at most one timeout at a time.
  private natResetTimeout_ :number;

  public getNatType = () : Promise<string> => {
    if (this.natType_ === '') {
      // Function that returns a promise which fulfills
      // in a given time.
      var countdown = (time) : Promise<void> => {
        return new Promise<void>((F, R) => {
          setTimeout(F, time);
        });
      }

      // Return the first Promise that fulfills in the 'race'
      // between a countdown and NAT provoking.
      // i.e., if NAT provoking takes longer than 30s, the countdown
      // will return first, and a time out message is returned.
      return Promise.race(
        [ countdown(30000).then(() => {
            return 'NAT classification timed out.';
          }),
          Diagnose.doNatProvoking().then((natType) => {
            this.natType_ = natType;
            // Store NAT type for five minutes. This way, if the user previews
            // their logs, and then submits them shortly after, we do not need
            // to determine the NAT type once for the preview, and once for
            // submission to our backend.
            // If we expect users to check NAT type frequently (e.g. if they
            // switch between networks while troubleshooting), then we might want
            // to remove caching.
            clearTimeout(this.natResetTimeout_);
            this.natResetTimeout_ = setTimeout(() => {this.natType_ = '';}, 300000);
            return this.natType_;
          })
        ]);
    } else {
      return Promise.resolve(this.natType_);
    }
  }

  public getNetworkInfo = () : Promise<string> => {
    return this.getNatType().then((natType) => {
      return 'NAT Type: ' + natType + '\n';
    });
  }

  public getLogs = () : Promise<string> => {
    return loggingProvider.getLogs().then((rawLogs) => {
        var formattedLogsWithVersionInfo =
            'Version: ' + JSON.stringify(UPROXY_VERSION) + '\n\n';
        formattedLogsWithVersionInfo += this.formatLogs_(rawLogs);
        return formattedLogsWithVersionInfo;
      });
  }

  public getLogsAndNetworkInfo = () : Promise<string> => {
    return Promise.all([this.getNetworkInfo(),
                        this.getLogs()])
      .then((natAndLogs) => {
        // natAndLogs is an array of returned values corresponding to the
        // array of Promises in Promise.all.
        return natAndLogs[0] + '\n' + natAndLogs[1];
      });
  }

  private formatLogs_ = (logs :string[]) : string => {
    // replace the emails with consistent tags throughout the logs
    var emails :string[] = [];
    var names :string[] = [];

    var emailReplacer = (email :string) :string => {
      var id = _.indexOf(emails, email);
      if (id === -1) {
        id = emails.length;
        emails.push(email);
      }

      return 'EMAIL_' + id;
    }

    var nameReplacer = (match :string, pre :string, name :string, post :string):string => {
      var id = _.indexOf(names, name);
      if (id === -1) {
        id = names.length;
        names.push(name);
      }

      return pre + 'NAME_' + id + post;
    }

    var text = logs.join('\n');

    // email regex taken from regular-expressions.info
    text = text.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}\b/ig,
                        emailReplacer);
    text = text.replace(/("name":")([^"]*)(")/g, nameReplacer);
    text = text.replace(/data:image\/.+;base64,[A-Za-z0-9+\/=]+/g, 'IMAGE_DATA');
    text = text.replace(/"imageData":"[^"]*"/g, '"imageData":"IMAGE_DATA"');
    text = text.replace(/"url":"[^"]*"/g, '"url":"URL"');
    return text;
  }
}  // class uProxyCore


// Prepare all the social providers from the manifest.
Social.initializeNetworks();
var core = new uProxyCore();

function _validateKeyHash(keyHash:string) {
  log.warn('keyHash validation not yet implemented');
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

core.onPromiseCommand(uProxy.Command.START_PROXYING_COPYPASTE_GET,
                      core.startCopyPasteGet);

core.onPromiseCommand(uProxy.Command.STOP_PROXYING_COPYPASTE_GET,
                      core.stopCopyPasteGet);

core.onCommand(uProxy.Command.START_PROXYING_COPYPASTE_SHARE,
               core.startCopyPasteShare);

core.onPromiseCommand(uProxy.Command.STOP_PROXYING_COPYPASTE_SHARE,
                      core.stopCopyPasteShare);

core.onCommand(uProxy.Command.COPYPASTE_SIGNALLING_MESSAGE,
               core.sendCopyPasteSignal);

core.onPromiseCommand(uProxy.Command.START_PROXYING, core.start);
core.onCommand(uProxy.Command.STOP_PROXYING, core.stop);

// TODO: Implement this or remove it.
// core.onCommand(uProxy.Command.CHANGE_OPTION, (data) => {
//   log.warn('CHANGE_OPTION yet to be implemented');
//   // TODO: Handle changes that might affect proxying.
// });

// TODO: make the invite mechanism an actual process.
// core.onCommand(uProxy.Command.INVITE, (userId:string) => {
// });

core.onCommand(uProxy.Command.HANDLE_MANUAL_NETWORK_INBOUND_MESSAGE,
               core.handleManualNetworkInboundMessage);
core.onCommand(uProxy.Command.UPDATE_GLOBAL_SETTINGS, core.updateGlobalSettings);
core.onPromiseCommand(uProxy.Command.GET_LOGS, core.getLogsAndNetworkInfo);
core.onPromiseCommand(uProxy.Command.GET_NAT_TYPE, core.getNatType);

// Now that this module has got itself setup, it sends a 'ready' message to the
// freedom background page.
bgAppPageChannel.emit('ready', null);
