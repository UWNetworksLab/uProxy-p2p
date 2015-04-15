import globals = require('./globals');

/**
 * Primary uProxy backend. Handles which social networks one is connected to,
 * sends updates to the UI, and handles commands from the UI.
 */
class uProxyCore implements uproxy_core_api.CoreApi {

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
  public login = (networkName :string) : Promise<void> => {
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
  public logout = (networkInfo :NetworkInfo) : Promise<void> => {
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
  onUpdate = (update, handler) => {}

  /**
   * Updates user's description of their current device. This applies to all
   * local instances for every network the user is currently logged onto. Those
   * local instances will then propogate their description update to all
   * instances.
   */
  public updateGlobalSettings = (newSettings :uproxy_core_api.GlobalSettings) => {
    newSettings.version = version.STORAGE_VERSION;
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
      (command :social.HandleManualNetworkInboundMessageCommand) => {
    var manualNetwork :social_network.ManualNetwork =
        <social_network.ManualNetwork> social_network.getNetwork(social.MANUAL_NETWORK_ID, '');
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
  public getInstance = (path :social.InstancePath) : remote_instance.RemoteInstance => {
    var user = this.getUser(path);
    if (!user) {
      log.error('No user', path.userId);
      return;
    }
    return user.getInstance(path.instanceId);
  }

  public getUser = (path :UserPath) : social.User => {
    var network = social_network.getNetwork(path.network.name, path.network.userId);
    if (!network) {
      log.error('No network', path.network.name);
      return;
    }
    return network.getUser(path.userId);
  }

  private FeedbackUrls_ = [
    'https://beta-dot-uproxysite.appspot.com/submit-feedback',
    'https://www.uproxy.org/submit-feedback'
  ]

  private post_ = (url :string, data :Object) :Promise<void> => {
    return new Promise<void>((fulfill, reject) => {
      var xhr = freedom['core.xhr']();

      xhr.on('onreadystatechange', () => {
        Promise.all([xhr.getReadyState(), xhr.getStatus()])
        .then((stateAndStatus) => {
          // 200 is the HTTP result code for a successful request.
          if (stateAndStatus[0] === XMLHttpRequest.DONE) {
            if (stateAndStatus[1] === 200) {
              fulfill();
            } else {
              reject(new Error('POST failed with HTTP code ' + stateAndStatus[1]));
            }
          }
        });
      });
      var params = JSON.stringify(data);

      xhr.open('POST', url, true);
      // core.xhr requires the parameters to be tagged as either a
      // string or array buffer in the format below.
      // This is roughly equivalent to standard xhr.send(params).
      xhr.send({'string': params});
    });
  }

  public sendFeedback = (feedback :uproxy_core_api.UserFeedback, maxAttempts?:number) : Promise<void> => {
    if (!maxAttempts || maxAttempts > this.FeedbackUrls_.length) {
      // default to trying every possible URL
      maxAttempts = this.FeedbackUrls_.length;
    }

    var logsPromise :Promise<string>;

    if (feedback.logs) {
      logsPromise = this.getLogsAndNetworkInfo().then((logs) => {
        var browserInfo = 'Browser Info: ' + feedback.browserInfo + '\n\n';
        return browserInfo + logs;
      });
    } else {
      logsPromise = Promise.resolve('');
    }

    return logsPromise.then((logs) => {
      var attempts = 0;

      var payload = {
        email: feedback.email,
        feedback: feedback.feedback,
        logs: logs
      };

      var doAttempts = (error?:Error) => {
        if (attempts < maxAttempts) {
          // we want to keep trying this until we either run out of urls to
          // send to or one of the requests succeeds.  We set this up by
          // creating a lambda to call the post with failures set up to recurse
          return this.post_(this.FeedbackUrls_[attempts++], payload).catch(doAttempts);
        }

        throw error;
      }

      return doAttempts();
    });
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
    text = text.replace(/data:image\/.+;base64,[A-Za-z0-9+\/=]+/g, 'IMAGE_DATA');
    text = text.replace(/("name":")([^"]*)(")/g, nameReplacer);
    return text;
  }
}  // class uProxyCore
