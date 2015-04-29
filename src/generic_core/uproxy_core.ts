import diagnose_nat = require('./diagnose-nat');
import globals = require('./globals');
import logging = require('../../../third_party/uproxy-lib/logging/logging');
import loggingTypes = require('../../../third_party/uproxy-lib/loggingprovider/loggingprovider.types');
import net = require('../../../third_party/uproxy-networking/net/net.types');
import remote_connection = require('./remote-connection');
import remote_instance = require('./remote-instance');
import social = require('../interfaces/social');
import social_network = require('./social');
import storage = globals.storage;
import ui_connector = require('./ui_connector');
import uproxy_core_api = require('../interfaces/uproxy_core_api');
import user = require('./remote-user');
import version = require('../version/version');
import _ = require('lodash');

import ui = ui_connector.connector;

export var remoteProxyInstance :social.RemoteUserInstance = null;

// This is a global instance of RemoteConnection that is currently used for
// either sharing or using a proxy through the copy+paste interface (i.e.
// without an instance)
export var copyPasteConnection :remote_connection.RemoteConnection = null;

var log :logging.Log = new logging.Log('core');
log.info('Loading core', version.UPROXY_VERSION);

// Note that the proxy runs extremely slowly in debug ('*:D') mode.
export var loggingController = freedom['loggingcontroller']();
loggingController.setDefaultFilter(
    loggingTypes.Destination.console,
    loggingTypes.Level.warn);
loggingController.setDefaultFilter(
    loggingTypes.Destination.buffered,
    loggingTypes.Level.debug);

/**
 * Primary uProxy backend. Handles which social networks one is connected to,
 * sends updates to the UI, and handles commands from the UI.
 */
export class uProxyCore implements uproxy_core_api.CoreApi {

  constructor() {
    log.debug('Preparing uProxy Core');
    copyPasteConnection = new remote_connection.RemoteConnection(ui.update);
  }

  // sendInstanceHandshakeMessage = (clientId :string) => {
  //   // TODO: Possibly implement this, or get rid of the possibility for
  //   // UI-initiated instance handshakes.
  // }

  changeOption = (option :string) => {
    // TODO: implement options.
  }

  dismissNotification = (instancePath :social.InstancePath) => {
    // TODO: implement options.
  }

  /**
   * Access various social networks using the Social API.
   */
  public login = (networkName :string) :Promise<void> => {
    if (networkName === social_network.MANUAL_NETWORK_ID) {
      var network = social_network.getNetwork(networkName, '');
      var loginPromise = network.login(true);
      loginPromise.then(() => {
        social_network.notifyUI(networkName);
        log.info('Logged in to manual network');
      });
      return loginPromise;
    }

    if (!(networkName in social_network.networks)) {
      log.warn('Network does not exist', networkName);
      return Promise.reject(new Error('Network does not exist (' + networkName + ')'));
    }
    var network = social_network.pendingNetworks[networkName];
    if (typeof network === 'undefined') {
      network = new social_network.FreedomNetwork(networkName);
      social_network.pendingNetworks[networkName] = network;
    }
    var loginPromise = network.login(true);
    loginPromise.then(() => {
      var userId :string = network.myInstance.userId;
      if (userId in social_network.networks[networkName]) {
        // If user is already logged in with the same (network, userId)
        // log out from existing network before replacing it.
        social_network.networks[networkName][userId].logout();
      }
      social_network.networks[networkName][userId] = network;
      delete social_network.pendingNetworks[networkName];
      log.info('Successfully logged in to network', {
        network: networkName,
        userId: userId
      });
    }).catch((e) => {
      log.error('Could not log in to network', e.stack);
      delete social_network.pendingNetworks[networkName];
    });

    // TODO: save the auto-login default.
    return loginPromise;
  }

  /**
   * Log-out of |networkName|.
   * TODO: write a test for this.
   */
  public logout = (networkInfo :social.SocialNetworkInfo) : Promise<void> => {
    var networkName = networkInfo.name;
    var userId = networkInfo.userId;
    var network = social_network.getNetwork(networkName, userId);
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
  onUpdate = (update:uproxy_core_api.Update, handler:Function) => {
    throw "uproxy_core onUpdate not implemented.";
  }

  /**
   * Updates user's description of their current device. This applies to all
   * local instances for every network the user is currently logged onto. Those
   * local instances will then propogate their description update to all
   * instances.
   */
  public updateGlobalSettings = (newSettings :uproxy_core_api.GlobalSettings) => {
    newSettings.version = globals.STORAGE_VERSION;
    if (newSettings.stunServers.length === 0) {
      newSettings.stunServers = globals.DEFAULT_STUN_SERVERS;
    }
    globals.storage.save<uproxy_core_api.GlobalSettings>('globalSettings', newSettings)
      .catch((e) => {
        log.error('Could not save globalSettings to storage', e.stack);
      });

    // Clear the existing servers and add in each new server.
    // Trying globalSettings = newSettings does not correctly update
    // pre-existing references to stunServers (e.g. from RemoteInstances).
    globals.settings.stunServers
        .splice(0, globals.settings.stunServers.length);
    for (var i = 0; i < newSettings.stunServers.length; ++i) {
      globals.settings.stunServers.push(newSettings.stunServers[i]);
    }

    if (newSettings.description != globals.settings.description) {
      globals.settings.description = newSettings.description;
      // Resend instance info to update description for logged in networks.
      for (var networkName in social_network.networks) {
        for (var userId in social_network.networks[networkName]) {
          social_network.networks[networkName][userId].resendInstanceHandshakes();
        }
      }
    }

    globals.settings.hasSeenSharingEnabledScreen =
        newSettings.hasSeenSharingEnabledScreen;
    globals.settings.hasSeenWelcome = newSettings.hasSeenWelcome;
    globals.settings.allowNonUnicast = newSettings.allowNonUnicast;
    globals.settings.mode = newSettings.mode;
    globals.settings.statsReportingEnabled = newSettings.statsReportingEnabled;
  }

  /**
   * Modifies the local consent value as the result of a local user action.
   * This is a distinct pathway from receiving consent bits over the wire, which
   * is handled directly inside the relevant social.Network.
   */
  public modifyConsent = (command:uproxy_core_api.ConsentCommand) => {
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

  public startCopyPasteGet = () : Promise<net.Endpoint> => {
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

  public sendCopyPasteSignal = (signal :social.PeerMessage) => {
    copyPasteConnection.handleSignal(signal);
  }

  /**
   * Begin using a peer as a proxy server.
   * Starts SDP negotiations with a remote peer. Assumes |path| to the
   * RemoteInstance exists.
   */
  public start = (path :social.InstancePath) : Promise<net.Endpoint> => {
    // Disable any previous proxying session.
    var stoppedGetting :Promise<void>[] = [];
    if (remoteProxyInstance) {
      log.warn('Existing proxying session, terminating');
      // Stop proxy, don't notify UI since UI request a new proxy.
      stoppedGetting.push(remoteProxyInstance.stop());
      remoteProxyInstance = null;
    }

    if (social.GettingState.NONE !== copyPasteConnection.localGettingFromRemote) {
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
      (command :social.HandleManualNetworkInboundMessageCommand) => {
    var manualNetwork :social_network.ManualNetwork =
        <social_network.ManualNetwork> social_network.getNetwork(
            social_network.MANUAL_NETWORK_ID, '');
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
  public getInstance = (path :social.InstancePath) :social.RemoteUserInstance => {
    var user = this.getUser(path);
    if (!user) {
      log.error('No user', path.userId);
      return;
    }
    return user.getInstance(path.instanceId);
  }

  public getUser = (path :social.UserPath) :social.RemoteUser => {
    var network = social_network.getNetwork(path.network.name, path.network.userId);
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
    if (globals.natType === '') {
      // Function that returns a promise which fulfills
      // in a given time.
      var countdown = (time:number) : Promise<void> => {
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
          diagnose_nat.doNatProvoking().then((natType:string) => {
            globals.natType = natType;
            // Store NAT type for five minutes. This way, if the user previews
            // their logs, and then submits them shortly after, we do not need
            // to determine the NAT type once for the preview, and once for
            // submission to our backend.
            // If we expect users to check NAT type frequently (e.g. if they
            // switch between networks while troubleshooting), then we might want
            // to remove caching.
            clearTimeout(this.natResetTimeout_);
            this.natResetTimeout_ = setTimeout(() => {globals.natType = '';}, 300000);
            return globals.natType;
          })
        ]);
    } else {
      return Promise.resolve(globals.natType);
    }
  }

  public getNetworkInfo = () : Promise<string> => {
    return this.getNatType().then((natType) => {
      return 'NAT Type: ' + natType + '\n';
    });
  }

  public getLogs = () : Promise<string> => {
    return loggingController.getLogs().then((rawLogs:string[]) => {
        var formattedLogsWithVersionInfo =
            'Version: ' + JSON.stringify(version.UPROXY_VERSION) + '\n\n';
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

  private formatLogs_ = (logs :string[]) :string => {
    // Searches through text for all JSON fields of the specified key, then
    // replaces the values with the prefix + a counter.
    // e.g.
    //   jsonFieldReplace(
    //       '{"name":"Alice"}...{\\"name\\":\\"Bob\\"}...Alice...Bob...',
    //        'name', 'NAME_');
    // will return:
    //   '{"name":"NAME_1"}...{\\"name\\":\\"NAME_2\\"}...NAME_1...NAME_2...'
    var jsonFieldReplace = (text :string, key :string, prefix :string)
        : string => {
      // Allow for escaped JSON to be matched, e.g. {\"name\":\"Bob\"}
      var re = new RegExp('\\\\*"' + key + '\\\\*":\\\\*"([^"]+)"', 'g');
      var matches :string[];
      var uniqueValueSet :{[value :string] :Boolean} = {};
      while (matches = re.exec(text)) {
        matches[1].replace(/\\+$/, '');  // Removing trailing \
        uniqueValueSet[matches[1]] = true;  // Add userId, name, etc to set.
      }
      var index = 1;
      for (var value in uniqueValueSet) {
        // Replace all occurances of value in text.
        // We need to convert value to a RegExp for global replacement, which
        // means replacing every \ with \\
        var escapedRegex = new RegExp(
            value.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&"),
            'g');
        text = text.replace(escapedRegex, prefix + index);
        ++index;
      }
      return text;
    }

    var text = logs.join('\n');

    text = jsonFieldReplace(text, 'name', 'NAME_');
    text = jsonFieldReplace(text, 'userId', 'USER_ID_');
    text = jsonFieldReplace(text, 'imageData', 'IMAGE_DATA_');
    text = jsonFieldReplace(text, 'url', 'URL_');

    // Replace any emails that may have been missed when replacing userIds.
    // Email regex taken from regular-expressions.info
    text = text.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}\b/ig,
                        'EMAIL_ADDRESS');
    return text;
  }
}  // class uProxyCore
