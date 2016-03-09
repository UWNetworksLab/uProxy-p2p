/// <reference path='../../../third_party/typings/freedom/freedom.d.ts' />

import bridge = require('../../../third_party/uproxy-lib/bridge/bridge');
import globals = require('./globals');
import _ = require('lodash');
import logging = require('../../../third_party/uproxy-lib/logging/logging');
import loggingTypes = require('../../../third_party/uproxy-lib/loggingprovider/loggingprovider.types');
import net = require('../../../third_party/uproxy-lib/net/net.types');
import onetime = require('../../../third_party/uproxy-lib/bridge/onetime');
import nat_probe = require('../../../third_party/uproxy-lib/nat/probe');
import remote_connection = require('./remote-connection');
import remote_instance = require('./remote-instance');
import user = require('./remote-user');
import social_network = require('./social');
import social = require('../interfaces/social');
import StoredValue = require('./stored_value');
import ui_connector = require('./ui_connector');
import uproxy_core_api = require('../interfaces/uproxy_core_api');
import version = require('../generic/version');

import ui = ui_connector.connector;
import storage = globals.storage;

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

var portControl = globals.portControl;

// Prefix for freedomjs modules which interface with cloud computing providers.
const CLOUD_PROVIDER_MODULE_PREFIX: string = 'CLOUDPROVIDER-';

const getCloudProviderNames = (): string[] => {
  let results: string[] = [];
  for (var dependency in freedom) {
    if (freedom.hasOwnProperty(dependency) &&
        dependency.indexOf(CLOUD_PROVIDER_MODULE_PREFIX) === 0) {
      results.push(dependency.substr(CLOUD_PROVIDER_MODULE_PREFIX.length));
    }
  }
  return results;
};

/**
 * Primary uProxy backend. Handles which social networks one is connected to,
 * sends updates to the UI, and handles commands from the UI.
 */
export class uProxyCore implements uproxy_core_api.CoreApi {

  private batcher_ : onetime.SignalBatcher<social.PeerMessage>;

  // this should be set iff an update to the core is available
  private availableVersion_ :string = null;

  private connectedNetworks_ = new StoredValue<string[]>('connectedNetworks', []);

  constructor() {
    log.debug('Preparing uProxy Core');
    copyPasteConnection = new remote_connection.RemoteConnection(
        (update:uproxy_core_api.Update, message?:social.PeerMessage) => {
      if (update !== uproxy_core_api.Update.SIGNALLING_MESSAGE) {
        ui.update(update, message);
      } else {
        this.batcher_.addToBatch(message);
      }
    }, undefined, portControl);

    this.refreshPortControlSupport();

    globals.loadSettings.then(() => {
      return this.connectedNetworks_.get();
    }).then((networks :string[]) => {
      var logins :Promise<void>[] = [];

      for (var i in networks) {
        var networkName = networks[i]
        if (!(networkName in social_network.networks)) {
          // Network may have been removed, e.g. old "Facebook" network is now
          // "Facebook-Firebase-V2".
          continue;
        }
        logins.push(this.login({
          network: networkName,
          loginType: uproxy_core_api.LoginType.RECONNECT
        }).catch(() => {
          // any failure to login should just be ignored - the user will either
          // be logged in with just some accounts or still on the login screen
          return;
        }));

        // at this point, clear all networks; those that successfully get logged
        // in will be re-added
        this.connectedNetworks_.set([]);
      }

      // this return is meaningless, but it may be useful in the future
      return Promise.all(logins);
    }).then(() => {
      log.info('Finished handling reconnections');
    });
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

  private pendingNetworks_ :{[name :string] :social.Network} = {};
  private portControlSupport_ = uproxy_core_api.PortControlSupport.PENDING;

  /**
   * Access various social networks using the Social API.
   */
  public login = (loginArgs :uproxy_core_api.LoginArgs) :Promise<void> => {
    var networkName = loginArgs.network;

    if (!(networkName in social_network.networks)) {
      log.warn('Network does not exist', networkName);
      return Promise.reject(new Error('Network does not exist (' + networkName + ')'));
    }

    var network = this.pendingNetworks_[networkName];
    if (typeof network === 'undefined') {
      network = new social_network.FreedomNetwork(networkName);
      this.pendingNetworks_[networkName] = network;
    }

    return network.login(loginArgs.loginType, loginArgs.userName).then(() => {
      delete this.pendingNetworks_[networkName];
      log.info('Successfully logged in to network', {
        network: networkName,
        userId: network.myInstance.userId
      });

      return this.connectedNetworks_.get().then((networks :string[]) => {
        if (_.includes(networks, networkName)) {
          return;
        }

        networks.push(networkName);
        return this.connectedNetworks_.set(networks);
      }).catch((e) => {
        console.warn('Could not save connected networks', e);
      });
    }, (e) => {
      delete this.pendingNetworks_[networkName];
      throw e;
    });
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

      return this.connectedNetworks_.get().then((networks) => {
        return this.connectedNetworks_.set(_.without(networks, networkName));
      }).catch((e) => {
        log.warn('Could not remove network from list of connected networks', e);
        // we will probably not be able to log back in anyways, ignore this
        return;
      });
    });
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
    var oldDescription = globals.settings.description;
    globals.storage.save('globalSettings', newSettings)
      .catch((e) => {
        log.error('Could not save globalSettings to storage', e.stack);
      });

    _.merge(globals.settings, newSettings, (a :Object, b :Object) => {
        // ensure we do not merge the arrays and that the reference remains intact
        if (_.isArray(a) && _.isArray(b)) {
          var arrayA = <Object[]>a;
          arrayA.splice(0, arrayA.length);
          for (var i in b) {
            arrayA.push((<Object[]>b)[i]);
          }
          return a;
        }

        // this causes us to fall back to the default merge behaviour
        return undefined;
    });

    if (globals.settings.description !== oldDescription) {
      // Resend instance info to update description for logged in networks.
      for (var networkName in social_network.networks) {
        for (var userId in social_network.networks[networkName]) {
          social_network.networks[networkName][userId].resendInstanceHandshakes();
        }
      }
    }

    loggingController.setDefaultFilter(
      loggingTypes.Destination.console,
      globals.settings.consoleFilter);
  }

  public getFullState = () :Promise<uproxy_core_api.InitialState> => {
    return globals.loadSettings.then(() => {
      var copyPasteConnectionState = copyPasteConnection.getCurrentState();

      return {
        networkNames: Object.keys(social_network.networks),
        cloudProviderNames: getCloudProviderNames(),
        globalSettings: globals.settings,
        onlineNetworks: social_network.getOnlineNetworks(),
        availableVersion: this.availableVersion_,
        copyPasteConnection: copyPasteConnectionState,
        portControlSupport: this.portControlSupport_,
      };
    });
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

  // Resets the copy/paste signal batcher.
  private resetBatcher_ = () : void => {
    this.batcher_ = new onetime.SignalBatcher<social.PeerMessage>((signal:string) => {
      ui.update(uproxy_core_api.Update.ONETIME_MESSAGE, signal);
    }, (signal:social.PeerMessage) => {
      // This is a terminating message iff signal.data is an instance
      // bridge.SignallingMessage (which we can detect by the presence
      // of a signals field) for which bridge.isTerminatingSignal
      // returns true.
      return signal.data && (<any>signal.data).signals &&
        bridge.isTerminatingSignal(<bridge.SignallingMessage>signal.data);
    }, true);
  }

  public startCopyPasteGet = () : Promise<net.Endpoint> => {
    this.resetBatcher_();
    return copyPasteConnection.startGet(globals.effectiveMessageVersion());
  }

  public stopCopyPasteGet = () :Promise<void> => {
    return copyPasteConnection.stopGet();
  }

  public startCopyPasteShare = () => {
    this.resetBatcher_();
    copyPasteConnection.startShare(globals.effectiveMessageVersion());
  }

  public stopCopyPasteShare = () :Promise<void> => {
    return copyPasteConnection.stopShare();
  }

  public sendCopyPasteSignal = (signal:string) => {
    var decodedSignals = <social.PeerMessage[]>onetime.decode(signal);
    decodedSignals.forEach(copyPasteConnection.handleSignal);
  }

  public inviteUser = (data: {networkId: string; userName: string}): Promise<void> => {
    // TODO: clean this up - hack to find the one network
    var network: social.Network;
    for (var userId in social_network.networks[data.networkId]) {
      network = social_network.networks[data.networkId][userId];
      break;
    }
    return network.inviteUser(data.userName);
  }

  public acceptInvitation = (data :uproxy_core_api.InvitationData) : Promise<void> => {
    var networkName = data.network.name;
    var networkUserId = data.network.userId;
    if (!networkUserId) {
      // Take the first key in the userId to social network map as the current user.
      // Assumes the user is only signed in once to any given network.
      networkUserId = Object.keys(social_network.networks[networkName])[0];
    }
    var network = social_network.getNetwork(networkName, networkUserId);
    return network.acceptInvitation(data.tokenObj, data.userId);
  }

  public getInviteUrl = (data :uproxy_core_api.InvitationData): Promise<string> => {
    var network = social_network.networks[data.network.name][data.network.userId];
    return network.getInviteUrl(data.userId || '');
  }

  public sendEmail = (data :uproxy_core_api.EmailData) : void => {
    var networkInfo = data.networkInfo;
    var network = social_network.networks[networkInfo.name][networkInfo.userId];
    network.sendEmail(data.to, data.subject, data.body);
  }

  /**
   * Begin using a peer as a proxy server.
   * Starts SDP negotiations with a remote peer. Assumes |path| to the
   * RemoteInstance exists.
   */
  public start = (path :social.InstancePath) : Promise<net.Endpoint> => {
    var remote = this.getInstance(path);
    if (!remote) {
      log.error('Instance does not exist for proxying', path.instanceId);
      return Promise.reject(new Error('Instance does not exist for proxying (' + path.instanceId + ')'));
    }
    // Remember this instance as our proxy.  Set this before start fulfills
    // in case the user decides to cancel the proxy before it begins.
    return remote.start();
  }

  /**
   * Stop proxying with the current instance, if it exists.
   */
  public stop = (path :social.InstancePath) => {
    var remote = this.getInstance(path);
    if (!remote) {
      log.error('Instance does not exist for proxying', path.instanceId);
      return Promise.reject(new Error('Instance does not exist for proxying (' + path.instanceId + ')'));
    }
    remote.stop();
    // TODO: Handle revoked permissions notifications.
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
  private natResetTimeout_ :NodeJS.Timer;

  public getNatType = () :Promise<string> => {
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
          nat_probe.probe().then((natType:string) => {
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

  // Probe for NAT-PMP, PCP, and UPnP support
  // Sets this.portControlSupport_ and sends update message to UI
  public refreshPortControlSupport = () :Promise<void> => {
    this.portControlSupport_ = uproxy_core_api.PortControlSupport.PENDING;
    ui.update(uproxy_core_api.Update.PORT_CONTROL_STATUS,
              uproxy_core_api.PortControlSupport.PENDING);

    return portControl.probeProtocolSupport().then(
      (probe:freedom.PortControl.ProtocolSupport) => {
        this.portControlSupport_ = (probe.natPmp || probe.pcp || probe.upnp) ?
                                   uproxy_core_api.PortControlSupport.TRUE :
                                   uproxy_core_api.PortControlSupport.FALSE;
        ui.update(uproxy_core_api.Update.PORT_CONTROL_STATUS,
                  this.portControlSupport_);
    });
  }

  // Probe the NAT type and support for port control protocols
  // Returns an object with the NAT configuration as keys
  public getNetworkInfoObj = () :Promise<uproxy_core_api.NetworkInfo> => {
    var natInfo :uproxy_core_api.NetworkInfo = {
      natType: undefined,
      pmpSupport: undefined,
      pcpSupport: undefined,
      upnpSupport: undefined
    };

    return this.getNatType().then((natType:string) => {
      natInfo.natType = natType;
      return portControl.probeProtocolSupport().then(
        (probe:freedom.PortControl.ProtocolSupport) => {
          natInfo.pmpSupport = probe.natPmp;
          natInfo.pcpSupport = probe.pcp;
          natInfo.upnpSupport = probe.upnp;
          return natInfo;
      }).catch((err:Error) => {
        // Should only catch the error when getInternalIp() times out
        natInfo.errorMsg = 'Could not probe for port control protocols: ' + err.message;
        return natInfo;
      });
    });
  }

  // Returns a string of the NAT type and support for port control protocols
  public getNetworkInfo = () :Promise<string> => {
    return this.getNetworkInfoObj().then((natInfo:uproxy_core_api.NetworkInfo) => {
      var natInfoStr = 'NAT Type: ' + natInfo.natType + '\n';
      if (natInfo.errorMsg) {
        natInfoStr += natInfo.errorMsg + '\n';
      } else {
        natInfoStr += 'NAT-PMP: ' +
                  (natInfo.pmpSupport ? 'Supported' : 'Not supported') + '\n';
        natInfoStr += 'PCP: ' +
                  (natInfo.pcpSupport ? 'Supported' : 'Not supported') + '\n';
        natInfoStr += 'UPnP IGD: ' +
                  (natInfo.upnpSupport ? 'Supported' : 'Not supported') + '\n';
      }
      return natInfoStr;
    });
  }

  public getLogs = () :Promise<string> => {
    return loggingController.getLogs().then((rawLogs:string[]) => {
        var formattedLogsWithVersionInfo =
            'Version: ' + JSON.stringify(version.UPROXY_VERSION) + '\n\n';
        formattedLogsWithVersionInfo += this.formatLogs_(rawLogs);
        return formattedLogsWithVersionInfo;
      });
  }

  public getLogsAndNetworkInfo = () :Promise<string> => {
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
        var escapedRegex = new RegExp(
            // Escape all special regex characters, from
            // http://stackoverflow.com/questions/3446170/
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

  public pingUntilOnline = (pingUrl :string) : Promise<void> => {
    var ping = () : Promise<void> => {
      return new Promise<void>(function(fulfill, reject) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', pingUrl);
        xhr.onload = function() { fulfill(); };
        xhr.onerror = function(e) { reject(new Error('Ping failed')); };
        xhr.send();
      });
    }

    return new Promise<void>((fulfill, reject) => {
      var checkIfOnline = () => {
        ping().then(() => {
          clearInterval(intervalId);
          fulfill();
        }).catch((e) => {
          // Ping failed (may be because the internet is disconnected),
          // we will try again on the next interval.
        });
      };
      var intervalId = setInterval(checkIfOnline, 5000);
      checkIfOnline();
    });
  }

  public getVersion = () :Promise<{ version :string }> => {
    return Promise.resolve(version.UPROXY_VERSION);
  }

  public handleUpdate = (details :{version :string}) => {
    this.availableVersion_ = details.version;
    ui.update(uproxy_core_api.Update.CORE_UPDATE_AVAILABLE, details);
  }

  public cloudInstall = (args:uproxy_core_api.CloudInstallArgs): Promise<uproxy_core_api.CloudInstallResult> => {
    if (args.providerName !== 'digitalocean') {
      return Promise.reject(new Error('unsupported cloud provider'));
    }

    if (!args.region) {
      return Promise.reject(new Error('no region specified for cloud provider'));
    }

    log.debug('logging into cloud provider %1', args.providerName);

    const provisioner = freedom[CLOUD_PROVIDER_MODULE_PREFIX + args.providerName]();
    const installer = freedom['cloudinstall']();

    const destroyModules = () => {
      freedom[CLOUD_PROVIDER_MODULE_PREFIX + args.providerName].close(provisioner);
      freedom['cloudinstall'].close(installer);
    };

    provisioner.on('status', (update: any) => {
      ui.update(uproxy_core_api.Update.CLOUD_INSTALL_STATUS, update.message);
    });

    // This is the server name recommended by the blog post.
    return provisioner.start('uproxy-cloud-server', args.region).then((serverInfo: any) => {
      log.info('created server on digitalocean: %1', serverInfo);

      const host = serverInfo.network.ipv4;
      const port = serverInfo.network.ssh_port;

      log.debug('installing cloud on %1:%2', host, port);

      // TODO: Send real updates. While we could trivially send stdout,
      //       that's extremely verbose right now.
      ui.update(uproxy_core_api.Update.CLOUD_INSTALL_STATUS, 'Installing...');

      // Attempt to install.  If install fails, retry will attempt again
      // up to MAX_INSTALLS times.  Failure may occur because we have just
      // created the server and it is not yet ready for SSH.
      // TODO: The provisioning module should return the username!
      const install = () => {
        return installer.install(host, port, 'root', serverInfo.ssh.private);
      };
      const MAX_INSTALLS = 5;
      return retry(install, MAX_INSTALLS);
    }).then((output: string) => {
      destroyModules();
      return <uproxy_core_api.CloudInstallResult>{
        invite: output
      };
    }, (e: Error) => {
      destroyModules();
      return Promise.reject(e);
    });
  }
}  // class uProxyCore

// Invoke an async function, and retry on error, calling func up to
// maxAttempts number of times.
export var retry = <T>(func :() => Promise<T>, maxAttempts :number) : Promise<T> => {
  return func().catch((err) => {
    --maxAttempts;
    if (maxAttempts > 0) {
      return retry(func, maxAttempts);
    } else {
      return Promise.reject(err)
    }
  });
}
