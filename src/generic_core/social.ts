/**
 * social.ts
 *
 * Interactions for network-specific social providers.
 *
 * To add new social providers, list them as dependencies in the primary
 * uProxy freedom manifest (freedom-module.json) with the 'SOCIAL-' prefix
 * in the name.
 *
 * e.g.
 *
 *  "dependencies": {
 *    ...
 *    "SOCIAL-websocket": {
 *      "url": "../lib/websocket-server/social.ws.json",
 *      "api": "social"
 *    },
 *    ...
 */

/// <reference path='../../../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../../third_party/typings/freedom/freedom-module-env.d.ts' />

import firewall = require('./firewall');
import globals = require('./globals');
import local_instance = require('./local-instance');
import logging = require('../../../third_party/uproxy-lib/logging/logging');
import network_options = require('../generic/network-options');
import remote_user = require('./remote-user');
import social = require('../interfaces/social');
import freedom_social2 = require('../interfaces/social2');
import ui_connector = require('./ui_connector');
import uproxy_core_api = require('../interfaces/uproxy_core_api');
import crypto = require('./crypto');
import ui = ui_connector.connector;

import storage = globals.storage;

var NETWORK_OPTIONS = network_options.NETWORK_OPTIONS;

var log :logging.Log = new logging.Log('social');

export var LOGIN_TIMEOUT :number = 5000;  // ms

// PREFIX is the string prefix indicating which social providers in the
// freedom manifest we want to treat as social providers for uProxy.
var PREFIX :string = 'SOCIAL-';
// Global mapping of social network names (without prefix) to actual Network
// instances that interact with that social network.
//
// TODO: rather than make this global, this should be a parameter of the core.
// This simplified Social to being a SocialNetwork and removes the need for
// this module. `initializeNetworks` becomes part of the core constructor.
export var networks:{[networkName:string] :{[userId:string]:social.Network}} = {};

export function removeNetwork(networkName :string, userId :string) :void {
  delete networks[networkName][userId];
  notifyUI(networkName, userId);
}

/**
 * Goes through network names and gets a reference to each social provider.
 */
export function initializeNetworks() :void {
  for (var dependency in freedom) {
    if (freedom.hasOwnProperty(dependency)) {
      if (dependency.indexOf(PREFIX) !== 0 ||
          ('social' !== freedom[dependency].api &&
           'social2' !== freedom[dependency].api)) {
        continue;
      }

      var name = dependency.substr(PREFIX.length);
      networks[name] = {};
    }
  }
}

/**
 * Retrieves reference to the network |networkName|.
 */
export function getNetwork(networkName :string, userId :string) :social.Network {
  if (!(networkName in networks)) {
    log.warn('Network does not exist', networkName);
    return null;
  }

  if (!(userId in networks[networkName])) {
    log.info('Not logged in to network', {
      userId: userId,
      network: networkName
    });
    return null;
  }
  return networks[networkName][userId];
}


export function getOnlineNetworks() :social.NetworkState[] {
  var networkStates :social.NetworkState[] = [];
  for (var networkName in networks) {
    for (var userId in networks[networkName]) {
      networkStates.push(networks[networkName][userId].getNetworkState());
    }
  }
  return networkStates;
}

export function notifyUI(networkName :string, userId :string) {
  if (typeof networks[networkName] === 'undefined') {
    throw Error('Trying to update UI with unknown network ' + networkName);
  }

  var network = getNetwork(networkName, userId);
  var online = false;
  var userName = '';
  var imageData = '';
  if (network !== null) {
    online = true;
    userName = network.myInstance.userName;
    imageData = network.myInstance.imageData;
  }

  var payload :social.NetworkMessage = {
    name: networkName,
    online: online,
    userId: userId,
    userName: userName,
    imageData: imageData
  };
  ui.update(uproxy_core_api.Update.NETWORK, payload);
}

  // Implements those portions of the Network interface for which the logic is
  // common to multiple Network implementations. Essentially an abstract base
  // class for Network implementations. TODO: with typescript 1.5, there are now
  // abstract classes, use them?
  export class AbstractNetwork implements social.Network {

    public roster     :{[userId:string] :remote_user.User};
    public myInstance :local_instance.LocalInstance;

    private SaveKeys = {
      ME: 'me'
    }

    constructor(public name :string) {
      this.roster = {};
    }

    public getStorePath = () :string => {
      return this.myInstance.instanceId + '/roster/';
    }

    /**
     * Returns the local instance. If it doesn't exist, load local instance
     * from storage, or create a new one if this is the first time this uProxy
     * installation has interacted with this network.
     */
    protected prepareLocalInstance_ = (userId :string) :Promise<void> => {
      var key = this.name + userId;
      return storage.load<social.LocalInstanceState>(key).then((result) => {
        this.myInstance = new local_instance.LocalInstance(this, userId, result);
        log.info('loaded local instance from storage',
                 result, this.myInstance.instanceId);
      }, (e) => {
        this.myInstance = new local_instance.LocalInstance(this, userId);
        log.info('generating new local instance', this.myInstance.instanceId);
        return this.myInstance.saveToStorage();
      });
    }

    //===================== Social.Network implementation ====================//

    /**
     * Adds a new user to the roster.  Promise will be rejected if the user is
     * already in the roster.
     */
    public addUser = (userId :string) :remote_user.User => {
      if (!this.isNewFriend_(userId)) {
        log.error('Cannot add already existing user', userId);
      }
      var newUser = new remote_user.User(this, userId);
      this.roster[userId] = newUser;
      return newUser;
    }

    /**
     * Returns a User object for userId.  If the userId is not found in the
     * roster, a new User object will be created - in that case the User may
     * be missing fields like .name if it is not found in storage.
     */
    protected getOrAddUser_ = (userId :string) :remote_user.User => {
      if (this.isNewFriend_(userId)) {
        return this.addUser(userId);
      }
      return this.getUser(userId);
    }

    /**
     * Helper to determine if |userId| is a "new friend".
     */
    protected isNewFriend_ = (userId :string) :boolean => {
      return !(userId in this.roster);
    }

    public getLocalInstanceId = () : string => {
      return this.myInstance.instanceId;
    }

    public getUser = (userId :string) :remote_user.User => {
      return this.roster[userId];
    }

    public resendInstanceHandshakes = () :void => {
      // Do nothing for non-freedom networks (e.g. manual).
    }

    public inviteUser = (userName: string): Promise<void> => {
      throw new Error("Operation not implemented.");
    }

    //================ Subclasses must override these methods ================//

    // From Social.Network:
    public login = (reconnect :boolean, userName?:string) :Promise<void> => {
      throw new Error('Operation not implemented');
    }
    public logout = () : Promise<void> => {
      throw new Error('Operation not implemented');
    }
    public flushQueuedInstanceMessages = () :void => {
      throw new Error('Operation not implemented');
    }
    public send = (user :remote_user.User,
                   recipientClientId :string,
                   message :social.PeerMessage) : Promise<void> => {
      throw new Error('Operation not implemented');
    }

    public getInviteUrl = () : Promise<string> => {
      throw new Error('Operation not implemented');
    }

    public sendEmail = (to: string, subject: string, body: string) : void => {
      throw new Error('Operation not implemented');
    }

    public getNetworkState = () :social.NetworkState => {
      throw new Error('Operation not implemented');
    }

    public areAllContactsUproxy = () : boolean => {
      // Default to false.
      var options :social.NetworkOptions = NETWORK_OPTIONS[this.name];
      return options ? options.areAllContactsUproxy === true : false;
    }

    public encryptsWithClientId = (): boolean => {
      // Default to false.
      var options: social.NetworkOptions = NETWORK_OPTIONS[this.name];
      return options ? options.encryptsWithClientId === true : false;
    }

    public acceptInvitation = (token ?:string, userId ?:string) : Promise<void> => {
      throw new Error('Operation not implemented');
    }

    public getKeyFromClientId = (clientId :string) : string => {
      var beginPgpString = '-----BEGIN PGP PUBLIC KEY BLOCK-----';
      var endPgpString = '-----END PGP PUBLIC KEY BLOCK-----\r\n';
      return clientId.match(beginPgpString + '(.|[\r\n])*' + endPgpString)[0];
    }

  }  // class AbstractNetwork


  // A Social.Network implementation that deals with a Freedom social provider.
  //
  // Handles events from the social provider. 'onUserProfile' events directly
  // affect the roster of this network, while 'onClientState' and 'onMessage'
  // events are passed on to the relevant user (provided the user exists).
  export class FreedomNetwork extends AbstractNetwork {

    private freedomApi_ :freedom_social2.FreedomSocialProvider;
    // TODO: give real typing to provider_. Ask Freedom not to use overloaded
    // types.
    private provider_ :any;  // Special freedom object which is both a function
                             // and object... cannot typescript.

    // Promise that delays all message handling until fully logged in.
    private onceLoggedIn_   :Promise<void>;

    // ID returned by setInterval call for monitoring.
    private monitorIntervalId_ :NodeJS.Timer = null;

    private fulfillLogout_ : () => void;
    private onceLoggedOut_ : Promise<void>;

    /**
     * Initializes the Freedom social provider for this FreedomNetwork and
     * attaches event handlers.
     */
    constructor(public name :string) {
      super(name);

      this.provider_ = freedom[PREFIX + name];
      this.onceLoggedIn_ = null;
      this.freedomApi_ = this.provider_();

      this.freedomApi_.on('onUserProfile',
                          this.delayForLogin_(this.handleUserProfile));
      this.freedomApi_.on('onClientState',
                          this.delayForLogin_(this.handleClientState));
      this.freedomApi_.on('onMessage',
                          this.delayForLogin_(this.handleMessage));
    }

    /**
     * Functor that delays until the network is logged in.
     * Resulting function will instantly fail if not already in the process of
     * logging in.
     * TODO: This should either be factored into a wrapper class to 'sanitize'
     * social providers' async behavior, or directly into freedom.
     */
    private delayForLogin_ = (handler :Function) => {
      return (arg :any) => {
        if (!this.onceLoggedIn_) {
          log.error('Attempting to call delayForLogin_ before trying to login');
          return;
        }
        return this.onceLoggedIn_.then(() => {
          handler(arg);
        });
      }
    }

    /**
     * Handler for receiving 'onUserProfile' messages. First, determines whether
     * the UserProfile belongs to ourselves or a remote contact. Then,
     * updates / adds the user data to the roster.
     *
     * NOTE: Our own 'Instance Handshake' is specific to this particular
     * network, and can only be prepared after receiving our own vcard for the
     * first time.
     * TODO: Check if the above statement on vcard is actually true.
     *
     * Public to permit testing.
     */

    public handleUserProfile = (profile :freedom.Social.UserProfile) : void => {
      var userId = profile.userId;
      if (!firewall.isValidUserProfile(profile, null)) {
        log.error('Firewall: invalid user profile', profile);
        return;
      }
      // Check if this is ourself, in which case we update our own info.
      if (userId == this.myInstance.userId) {
        // TODO: we may want to verify that our status is ONLINE before
        // sending out any instance messages.
        log.info('Received own UserProfile', profile);

        // Update UI with own information.
        var userProfileMessage :social.UserProfileMessage = {
          userId: profile.userId,
          name: profile.name,
          imageData: profile.imageData
        };
        ui.update(uproxy_core_api.Update.USER_SELF, <social.UserData>{
          network: this.name,
          user:    userProfileMessage
        });

        this.myInstance.updateProfile(userProfileMessage);
      }
      log.debug('Received UserProfile', profile);
      this.getOrAddUser_(userId).update(profile);
    }

    /**
     * Handler for receiving 'onClientState' messages. Passes these messages to
     * the relevant user, which will manage its own clients.
     *
     * It is possible that the roster entry does not yet exist for a user,
     * yet we receive a client state from them. In this case, create a
     * place-holder user until we receive more user information.
     *
     * Assumes we are in fact fully logged in.
     *
     * Public to permit testing.
     */
    public handleClientState = (freedomClient :freedom.Social.ClientState) : Promise<void> => {
      if (!firewall.isValidClientState(freedomClient, null)) {
        log.error('Firewall: invalid client state:', freedomClient);
        return Promise.reject(
            'Firewall: invalid client state:' + JSON.stringify(freedomClient));
      }
      var client :social.ClientState =
        freedomClientToUproxyClient(freedomClient);
      return this.validateClient_(client).then((isValid :boolean) => {
        if (!isValid) {
          return;
        }

        if (client.userId == this.myInstance.userId &&
            client.clientId === this.myInstance.clientId) {
          if (client.status === social.ClientStatus.OFFLINE) {
            // Our client is disconnected, log out of the social network
            // (the social provider is responsible for clean up so we don't
            // need to call logout here).
            this.fulfillLogout_();
          }
          log.info('received own ClientState', client);
          return;
        }

        this.getOrAddUser_(client.userId).handleClient(client);
      });
    }

    /**
     * When receiving a message from a social provider, delegate it to the
     * correct user, which will delegate to the correct client.
     *
     * It is possible that the roster entry does not yet exist for a user,
     * yet we receive a message from them. In this case, create a place-holder
     * user until we receive more user information.
     *
     * Public to permit testing.
     */
    public handleMessage = (incoming :freedom.Social.IncomingMessage) : Promise<void> => {
      if (!firewall.isValidIncomingMessage(incoming, null)) {
        log.error('Firewall: invalid incoming message:', incoming);
        return;
      }
      var userId = incoming.from.userId;

      var client :social.ClientState =
          freedomClientToUproxyClient(incoming.from);
      return this.validateClient_(client).then((isValid :boolean) => {
        if (!isValid) {
          return;
        }

        var user = this.getOrAddUser_(userId);
        if (!user.clientIdToStatusMap[client.clientId]) {
          // Add client.
          user.handleClient(client);
        }

        // Decrypt message.
        var decryptMessage = Promise.resolve(incoming.message);
        if (this.encryptsWithClientId()) {
          var key = this.getKeyFromClientId(client.clientId);
          decryptMessage = crypto.verifyDecrypt(incoming.message, key);
        }

        return decryptMessage.then((messageString :string) => {
          var msg :social.VersionedPeerMessage = JSON.parse(messageString);
          log.info('received message', {
            userFrom: user.userId,
            clientFrom: client.clientId,
            instanceFrom: user.clientToInstance(client.clientId),
            msg: msg
          });
          user.handleMessage(client.clientId, msg);
        });
      });
    }

    // Clients currently pending validation (due to async verifyDecrypt call).
    private pendingClients_ :{ [clientId :string] :Promise<boolean> } = {};

    private validateClient_ = (client :social.ClientState) : Promise<boolean> => {
      if (client.status === social.ClientStatus.ONLINE_WITH_OTHER_APP) {
        // Ignore clients that aren't using uProxy.
        return Promise.resolve(false);
      }
      if (this.name !== 'Quiver') {
        // No more validation to do for non-Quiver networks
        return Promise.resolve(true);
      }

      // Hack around ClientState type, as inviteResponse is only available
      // for Quiver and not checked into mainline freedom yet.
      var inviteResponse = (<any>client)['inviteResponse'];
      if (inviteResponse) {
        var key = this.getKeyFromClientId(client.clientId);

        var decryptAndValidate = crypto.verifyDecrypt(inviteResponse, key)
        .then((plainText :string) => {
          // Cleanup pending validation now that no more async calls are needed
          // to complete validation.
          delete this.pendingClients_[client.clientId];

          // Parse invite data
          try {
            var inviteData :social.inviteResponse = JSON.parse(plainText);
          } catch (e) {
            log.warn('Invalid invite data: ' + plainText);
            return Promise.resolve(false);
          }

          // Sanity check
          if (this.getKeyFromClientId(client.clientId) != inviteData.publicKey) {
            log.warn('clientId does not match publicKey ' +
                client.clientId + ', ' + inviteData.publicKey);
            return Promise.resolve(false);
          }

          if (!this.myInstance.isValidInvite(inviteData.permissionToken)) {
            console.warn('Invalid permission token');
            return Promise.resolve(false);
          }

          // Add to user's list of known public keys
          var user = this.getOrAddUser_(client.userId);
          user.knownPublicKeys.push(inviteData.publicKey);

          return Promise.resolve(true);
        }).catch((e) => {
          log.error('Error decrypting inviteResponse', e);
          return Promise.resolve(false);
        });

        // Save decrypt promise, so we know this client is pending validation.
        this.pendingClients_[client.clientId] = decryptAndValidate;
        return decryptAndValidate;
      }

      if (this.pendingClients_[client.clientId]) {
        // Client is currently being validated
        return this.pendingClients_[client.clientId];
      }

      var user = this.getUser(client.userId);
      if (!user) {
        // No user exists yet, and inviteResponse was not set - do not
        // create a new user yet and just return invalid.
        // Note: sometimes Quiver emits onClientState events for clients before
        // it includes the inviteResponse.  uProxy should just ignore these
        // and not print errors.
        log.info('No user found: ' + client.userId);
        return Promise.resolve(false);
      }

      // At this point we have a client without any inviteResponse set for an
      // already existing user, just verify that the clientId appears in the
      // user's list of knownPublicKeys.
      if (user.knownPublicKeys.indexOf(this.getKeyFromClientId(client.clientId)) >= 0) {
        return Promise.resolve(true);
      } else {
        log.warn('Got unknown clientId: ' + client.clientId);
        return Promise.resolve(false);
      }
    }

    public restoreFromStorage() {
      // xmpp is weird, so we need to do this.
      log.info('Loading users from storage');
      return storage.keys().then((keys :string[]) => {
        var myKey = this.getStorePath();
        for (var i in keys) {
          if (keys[i].indexOf(myKey) === 0) {
            var userId = keys[i].substr(myKey.length);
            if (this.isNewFriend_(userId)) {
              this.addUser(userId);
            }
          }
        }
      });
    }

    //===================== Social.Network implementation ====================//

    public login = (reconnect :boolean, userName ?:string) : Promise<void> => {
      var request :freedom_social2.LoginRequest = null;
      if (this.isFirebase_()) {
        // Firebase enforces only 1 login per agent per userId at a time.
        // TODO: ideally we should use the instanceId for the agent string,
        // that way the clientId we get will just be in the form
        // userId/instanceId and can eliminate the 1st round of instance
        // messages.  However we don't know the instanceId until after we login,
        // because each instanceId is generated or loaded from storage based
        // on the userId.  Some possibilities:
        // - modify the freedom API to set our agent after login (once we
        //   know our userId)
        // - change the way we generate the instanceId to not depend on what
        //   userId is logged in.
        // If we change agent to use instanceId, we also should modify
        // Firebase code to change disconnected clients to OFFLINE, rather
        // than removing them.
        var agent = 'uproxy' + Math.random().toString().substr(2,10);
        request = {
          agent: agent,
          version: '0.1',
          url: 'https://popping-heat-4874.firebaseio.com/',
          interactive: !reconnect,
          rememberLogin: !reconnect
        };
      } else if (this.name === 'Quiver') {
        if (!userName) {
          // userName may not be passed in for reconnect.
          userName = globals.settings.quiverUserName;
        }
        request = {
          agent: globals.publicKey,
          version: '0.1',
          url: 'https://github.com/uProxy/uProxy',
          interactive: !reconnect,
          rememberLogin: !reconnect,
          userName: userName
        };
      } else {
        request = {
          agent: 'uproxy',
          version: '0.1',
          url: 'https://github.com/uProxy/uProxy',
          interactive: !reconnect,
          rememberLogin: !reconnect
        };
      }

      this.onceLoggedIn_ = this.freedomApi_.login(request)
          .then((freedomClient :freedom.Social.ClientState) => {
            var userId = freedomClient.userId;
            if (userId in networks[this.name]) {
              // If user is already logged in with the same (network, userId)
              // log out from existing network before replacing it.
              networks[this.name][userId].logout();
            }
            networks[this.name][userId] = this;

            // Upon successful login, save local client information.
            this.startMonitor_();
            log.info('logged into network', this.name);
            return this.prepareLocalInstance_(userId).then(() => {
              this.myInstance.clientId = freedomClient.clientId;
              // Notify UI that this network is online before we fulfill
              // the onceLoggedIn_ promise.  This ensures that the UI knows
              // that the network is online before we send user updates.
              notifyUI(this.name, userId);
            });
          });
      return this.onceLoggedIn_
          .then(() => {
            this.onceLoggedOut_ = new Promise((F, R) => {
              this.fulfillLogout_ = F;
            }).then(() => {
              this.stopMonitor_();
              for (var userId in this.roster) {
                this.roster[userId].handleLogout();
              }
              removeNetwork(this.name, this.myInstance.userId);
              log.debug('Fulfilling onceLoggedOut_');
            }).catch((e) => {
              log.error('Error fulfilling onceLoggedOut_', e.message);
            });
            this.restoreFromStorage();
          })
          .catch((e) => {
            log.error('Could not login to network');
            throw e;
          });
    }

    public logout = () : Promise<void> => {
      return this.freedomApi_.logout().then(() => {
        this.fulfillLogout_();
      }).catch((e) => {
        log.error('Error while logging out:', e.message);
        return Promise.reject(e);
      });
    }

    public acceptInvitation = (token ?:string, userId ?:string) : Promise<void> => {
      if (this.name === 'Quiver') {
        return this.acceptQuiverInvitation_(token);
      }

      var networkData :string = null;
      if (token) {
        // token may be a URL with a token, or just the token.  Remove the
        // prefixed URL if it is set.
        token = token.lastIndexOf('/') >= 0 ?
            token.substr(token.lastIndexOf('/') + 1) : token;
        try {
          networkData = JSON.parse(atob(token)).networkData;
        } catch (e) {
          return Promise.reject('Invalid invite token ' + token);
        }
      } else if (userId) {
        networkData = userId;
      }
      return this.freedomApi_.acceptUserInvitation(networkData).catch((e) => {
        log.error('Error calling acceptUserInvitation: ' + networkData, e.message);
      });
    }

    private acceptQuiverInvitation_ = (token :string) : Promise<void> => {
      // token may be a URL with a token, or just the token.  Remove the
      // prefixed URL if it is set.
      token = token.lastIndexOf('/') >= 0 ?
          token.substr(token.lastIndexOf('/') + 1) : token;
      try {
        var tokenObj = JSON.parse(atob(token));
        var remoteUserId = tokenObj.userId;
        var remotePublicKey = tokenObj.publicKey;
        var remotePermissionToken = tokenObj.permissionToken;
        var networkData = tokenObj.networkData;
      } catch (e) {
        return Promise.reject('Invalid invite token ' + token);
      }

      // Get/create remoteUser, update their knownPublicKeys.
      var remoteUser = this.getOrAddUser_(remoteUserId);
      remoteUser.knownPublicKeys.push(remotePublicKey);
      remoteUser.saveToStorage();

      // Data to pass back to the user who generated the invite token
      // so they can know who we are and verify that the token is valid
      var inviteAcceptanceObj = {
        userId: this.myInstance.userId,  // local user id
        publicKey: globals.publicKey, // public key of local instance
        permissionToken: remotePermissionToken  // received permission token
      }
      var inviteAcceptanceString = JSON.stringify(inviteAcceptanceObj);

      // Encrypt inviteAcceptanceData with the remotePublicKey
      return crypto.signEncrypt(inviteAcceptanceString, remotePublicKey)
      .then((cipherText :string) => {
        return this.freedomApi_.acceptUserInvitation(networkData, cipherText)
        .catch((e :Error) => {
          log.error('Error calling acceptUserInvitation: ' + networkData, e.message);
        });
      });
    }

    public inviteUser = (userName: string): Promise<void> => {
      return this.freedomApi_.inviteUser(userName).catch((e) => {
        log.error('Error calling inviteUser: ' + userName, e.message);
        return Promise.reject('Error calling inviteUser: ' + userName + e.message);
      }).then(() => {
        return Promise.resolve<void>();
      });
    }

    public getInviteUrl = () : Promise<string> => {
      return this.freedomApi_.inviteUser('').then((data: { networkData :string }) => {
        var tokenObj :Object;
        if (this.name === 'Quiver') {
          var permissionToken = this.myInstance.generateInvitePermissionToken();
          tokenObj = {
            v: 2,
            networkName: this.name,
            userName: this.myInstance.userName,
            networkData: data.networkData,
            userId: this.myInstance.userId,
            publicKey: globals.publicKey,
            permissionToken: permissionToken
          };
        } else {
          tokenObj = {
            v: 1,
            networkName: this.name,
            userName: this.myInstance.userName,
            networkData: data.networkData
          };
        }
        return 'https://www.uproxy.org/invite/' + btoa(JSON.stringify(tokenObj));
      })
    }

    public sendEmail = (to: string, subject: string, body: string): void => {
      this.freedomApi_.sendEmail(to, subject, body).catch((e :Error) => {
        log.error('Error sending email', e);
      });
    }

    /**
     * Promise the sending of |msg| to a client with id |clientId|.
     */
    public send = (user :remote_user.User,
                   clientId :string,
                   message :social.PeerMessage) : Promise<void> => {
      var versionedMessage :social.VersionedPeerMessage = {
        type: message.type,
        data: message.data,
        version: globals.effectiveMessageVersion()
      };
      var messageString = JSON.stringify(versionedMessage);
      log.info('sending message', {
        userTo: user.userId,
        clientTo: clientId,
        // Instance may be undefined if we are making an instance request,
        // i.e. we know that a client is ONLINE with uProxy, but don't
        // yet have their instance info.  This is not an error.
        instanceTo: user.clientToInstance(clientId),
        msg: messageString
      });
      if (this.encryptsWithClientId()) {
        var key = this.getKeyFromClientId(clientId);
        return crypto.signEncrypt(messageString, key).then((cipherText :string) => {
          return this.freedomApi_.sendMessage(clientId, cipherText);
        });
      } else {
        return this.freedomApi_.sendMessage(clientId, messageString);
      }
    }

    // TODO: We should make a class for monitors or generally to encapsulate
    // setInterval/clearInterval calls.  Then we could call monitor.start
    // and monitor.stop.
    private startMonitor_ = () : void => {
      if (this.monitorIntervalId_) {
        // clear any existing monitor
        log.error('startMonitor_ called with monitor already running');
        this.stopMonitor_();
      } else if (!this.isMonitoringEnabled_()) {
        return;
      }

      var monitorCallback = () => {
        // TODO: if too many instances are missing, we may send more messages
        // than our XMPP server will allow and be throttled.  We should change
        // monitoring to limit the number of XMPP messages it sends on each
        // interval.
        for (var userId in this.roster) {
          this.getUser(userId).monitor();
        }
      };
      this.monitorIntervalId_ = setInterval(monitorCallback, 60000);
    }

    private stopMonitor_ = () : void => {
      if (this.monitorIntervalId_) {
        clearInterval(this.monitorIntervalId_);
      }
      this.monitorIntervalId_ = null;
    }

    public resendInstanceHandshakes = () : void => {
      for (var userId in this.roster) {
        this.roster[userId].resendInstanceHandshakes();
      }
    }

    private isFirebase_ = () : boolean => {
      // Default to false.
      var options :social.NetworkOptions = NETWORK_OPTIONS[this.name];
      return options ? options.isFirebase === true : false;
    }

    private isMonitoringEnabled_ = () : boolean => {
      // Default to true.
      var options :social.NetworkOptions = NETWORK_OPTIONS[this.name];
      return options ? options.enableMonitoring === true : true;
    }

    public getNetworkState = () :social.NetworkState => {
      var rosterState :{[userId :string] :social.UserData} = {};
      for (var userId in this.roster) {
        var userState = this.roster[userId].currentStateForUI()
        if (userState !== null) {
          rosterState[userId] = userState;
        }
      }

      return {
        name: this.name,
        profile: this.myInstance.getUserProfile(),
        roster: rosterState
      };
    }

  }  // class Social.FreedomNetwork

export function freedomClientToUproxyClient(
  freedomClientState :freedom.Social.ClientState) :social.ClientState {
  // Convert status from Freedom style enum value ({'ONLINE': 'ONLINE',
  // 'OFFLINE: 'OFFLINE'}) to TypeScript style {'ONLINE': 4000, 4000: 'ONLINE',
  // 'OFFLINE': 4001, 4001: 'OFFLINE'} value.
  var state :social.ClientState = {
    userId:    freedomClientState.userId,
    clientId:  freedomClientState.clientId,
    status:    (<any>social.ClientStatus)[freedomClientState.status],
    timestamp: freedomClientState.timestamp,
    // Cast to any because inviteResponse is not yet on "mainstream"
    // freedom definitions and is only available to Quiver
    inviteResponse: (<any>freedomClientState)['inviteResponse']
  };
  return state;
}
