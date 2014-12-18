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
/// <reference path='local-instance.ts' />
/// <reference path='user.ts' />
/// <reference path='util.ts' />
/// <reference path='../uproxy.ts' />
/// <reference path='../interfaces/network.d.ts' />
/// <reference path='../interfaces/persistent.d.ts' />

/// <reference path='../freedom/typings/freedom.d.ts' />
/// <reference path='../freedom/typings/social.d.ts' />
/// <reference path='../third_party/typings/es6-promise/es6-promise.d.ts' />


module Social {

  var LOGIN_TIMEOUT :number = 5000;  // ms


  // PREFIX is the string prefix indicating which social providers in the
  // freedom manifest we want to treat as social providers for uProxy.
  var PREFIX:string = 'SOCIAL-';
  // Global mapping of social network names (without prefix) to actual Network
  // instances that interact with that social network.
  //
  // TODO: rather than make this global, this should be a parameter of the core.
  // This simplified Social to being a SocialNetwork and removes the need for
  // this module. `initializeNetworks` becomes part of the core constructor.
  // TODO(salomegeo): Change structure of network
  export var networks:{[networkName:string] :{[userId:string]:Network}} = {};
  export var pendingNetworks:{[networkName:string]:Network} = {};

  /**
   * Goes through network names and gets a reference to each social provider.
   */
  export function initializeNetworks() {
    for (var dependency in freedom) {
      if (freedom.hasOwnProperty(dependency)) {
        if (dependency.indexOf(PREFIX) !== 0 ||
            'social' !== freedom[dependency].api) {
          continue;
        }

        var name = dependency.substr(PREFIX.length);
        networks[name] = {};
      }
    }

    // TODO: re-enable manual networks here when all code is ready
    // Social.networks[MANUAL_NETWORK_ID] = {
    //     '': new Social.ManualNetwork(MANUAL_NETWORK_ID)};
  }

  /**
   * Retrieves reference to the network |networkName|.
   */
  export function getNetwork(networkName :string, userId :string) : Network {
    if (!(networkName in networks)) {
      console.warn('Network does not exist: ' + networkName);
      return null;
    }

    if (!(userId in networks[networkName])) {
      console.log('Not logged in with userId ' + userId + ' in network ' + networkName);
      return null
    }
    return networks[networkName][userId];
  }

  export function notifyUI(networkName :string) {
    var userId = '';
    var online = false;
    if (Object.keys(networks[networkName]).length > 0) {
      online = true;
      // Hack. Once we have a support for multiple networks in ui
      // we'll change this.
      userId = (Object.keys(networks[networkName]))[0];
    };
    var payload :UI.NetworkMessage = {
      name: networkName,
      online: online,
      userId: userId
    };
    ui.update(uProxy.Update.NETWORK, payload);
  }

  // Implements those portions of the Network interface for which the logic is
  // common to multiple Network implementations. Essentially an abstract base
  // class for Network implementations, except that TypeScript does not allow
  // abstract classes.
  export class AbstractNetwork implements Network {

    public roster     :{[userId: string] :Core.User};
    public myInstance :Core.LocalInstance;

    private SaveKeys = {
      ME: 'me'
    }

    constructor(public name :string) {
      this.roster = {};
    }

    public getStorePath = () => {
      return this.myInstance.instanceId + '/roster/';
    }

    /**
     * Returns the local instance. If it doesn't exist, load local instance
     * from storage, or create a new one if this is the first time this uProxy
     * installation has interacted with this network.
     */
    public prepareLocalInstance = (userId :string) : Promise<void> => {
      var key = this.name + userId;
      return storage.load<Instance>(key).then((result :Instance) => {
        console.log(JSON.stringify(result));
        this.myInstance = new Core.LocalInstance(this, userId, result);
        this.log('loaded local instance from storage: ' +
                 this.myInstance.instanceId);
      }, (e) => {
        this.myInstance = new Core.LocalInstance(this, userId);
        this.log('generating new local instance: ' +
                 this.myInstance.instanceId);
        return this.myInstance.prepare().then(() => {
            return storage.save<Instance>(key, this.myInstance.currentState());
          }).then((prev) => {
            this.log('saved new local instance to storage');
          });
      });
    }

    //===================== Social.Network implementation ====================//

    public getLocalInstance = () : Core.LocalInstance => {
      return this.myInstance;
    }

    public getUser = (userId :string) : Core.User => {
      return this.roster[userId];
    }
    /**
     * Sends our instance handshake to a list of clients, returning a promise
     * that all handshake messages have been sent.
     *
     * Intended to be protected, but TypeScript has no 'protected' modifier.
     */
    public sendInstanceHandshake = (clientId :string, consent :Consent.WireState) : Promise<void> => {
      if (!this.myInstance) {
        // TODO: consider waiting until myInstance is constructing
        // instead of dropping this message.
        // Currently we will keep receiving INSTANCE_REQUEST until instance
        // handshake is sent to the peer.
        console.error('Not ready to send handshake');
        return;
      }
      var handshake = {
        type: uProxy.MessageType.INSTANCE,
        data: {
         handshake: this.myInstance.getInstanceHandshake(),
         consent: consent
        }
      };

      return this.send(clientId, handshake).then(() => {
        this.log('Sent instance handshake to ' + clientId);
      });
    }

    /**
     * Intended to be protected, but TypeScript has no 'protected' modifier.
     */
    public log = (msg :string) : void => {
      console.log('[' + this.name + '] ' + msg);
    }

    /**
     * Intended to be protected, but TypeScript has no 'protected' modifier.
     */
    public error = (msg :string) : void => {
      console.error('!!! [' + this.name + '] ' + msg);
    }

    public resendInstanceHandshakes = () => {
      // Do nothing for non-freedom networks (e.g. manual).
    }

    //================ Subclasses must override these methods ================//

    // From Social.Network:
    public login = (remember :boolean) : Promise<void> => {
      throw new Error('Operation not implemented');
    }
    public logout = () : Promise<void> => {
      throw new Error('Operation not implemented');
    }
    public flushQueuedInstanceMessages = () => {
      throw new Error('Operation not implemented');
    }
    public send = (recipientClientId :string,
                   message :uProxy.Message) : Promise<void> => {
      throw new Error('Operation not implemented');
    }

  }  // class AbstractNetwork


  // A Social.Network implementation that deals with a Freedom social provider.
  //
  // Handles events from the social provider. 'onUserProfile' events directly
  // affect the roster of this network, while 'onClientState' and 'onMessage'
  // events are passed on to the relevant user (provided the user exists).
  export class FreedomNetwork extends AbstractNetwork {

    private freedomApi_ :freedom_Social;
    // TODO: give real typing to provider_. Ask Freedom not to use overloaded
    // types.
    private provider_ :any;  // Special freedom object which is both a function
                             // and object... cannot typescript.

    // Promise that delays all message handling until fully logged in.
    private onceLoggedIn_   :Promise<void>;
    private remember :boolean;

    // ID returned by setInterval call for monitoring.
    private monitorIntervalId_ :number = null;

    /**
     * Initializes the Freedom social provider for this FreedomNetwork and
     * attaches event handlers.
     */
    constructor(public name :string) {
      super(name);

      this.provider_ = freedom[PREFIX + name];
      this.remember = false;
      this.onceLoggedIn_ = null;
      this.freedomApi_ = this.provider_();

      // TODO: Update these event name-strings when freedom updates to
      // typescript and Enums.
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
          this.error('Not logged in.');
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
    public handleUserProfile = (profile :freedom_Social.UserProfile) => {
      var userId = profile.userId;
      // Check if this is ourself, in which case we update our own info.
      if (userId == this.myInstance.userId) {
        // TODO: we may want to verify that our status is ONLINE before
        // sending out any instance messages.
        this.log('<-- XMPP(self) [' + profile.name + ']\n' + profile);

        // Update UI with own information.
        var userProfileMessage :UI.UserProfileMessage = {
          userId: profile.userId,
          name: profile.name,
          imageData: profile.imageData,
          isOnline: true
        };
        ui.update(uProxy.Update.USER_SELF, <UI.UserMessage>{
          network: this.name,
          user:    userProfileMessage
        });

        return;
      }
      // Otherwise, this is a remote contact. Add them to the roster if
      // necessary, and update their profile.
      this.log('<--- XMPP(friend) [' + profile.name + ']' + profile);
      if (!(userId in this.roster)) {
        this.addUser_(userId);
      }
      this.getUser(userId).update(profile);
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
    public handleClientState = (freedomClient :freedom_Social.ClientState)
        : void => {
      var client :UProxyClient.State =
        freedomClientToUproxyClient(freedomClient);
      if (client.userId == this.myInstance.userId) {
        // Log out if it's our own client id.
        // TODO: Consider adding myself to the roster.
        if (client.clientId === this.myInstance.clientId &&
            client.status === UProxyClient.Status.OFFLINE) {
          ui.showNotification('You have been logged out of ' + this.name);
          core.logout({name: this.name, userId: this.myInstance.userId});
        }
        this.log('received own ClientState: ' + JSON.stringify(client));
        return;
      }
      if (this.isNewFriend_(client.userId)) {
        this.log('received ClientState for ' + client.userId +
                 ' before UserProfile.');
        this.addUser_(client.userId);
      }
      this.getUser(client.userId).handleClient(client);
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
    public handleMessage = (incoming :freedom_Social.IncomingMessage)
        : void => {
      var userId = incoming.from.userId;
      if (this.isNewFriend_(userId)) {
        this.log('received Message for ' + userId + ' before UserProfile.');
        this.addUser_(userId);
      }
      var msg :uProxy.Message = JSON.parse(incoming.message);
      this.log('received <------ ' + incoming.message);
      this.getUser(userId).handleMessage(incoming.from.clientId, msg);
    }

    /**
     * Sometimes Network receives messages or ClientStates for userIds for which
     * we've yet to receive a UserProfile. In any case, we can begin with an
     * inital user.
     *
     * Assumes that |userId| is in fact a new user. (There will be a problem if
     * it overwrites an existing user in the roster.)
     */
    private addUser_ = (userId :string) => {
      if (!this.isNewFriend_(userId)) {
        this.error(this.name + ': cannot add already existing user!');
        return;
      }
      this.log('added "' + userId + '" to roster.');
      this.roster[userId] = new Core.User(this, userId);
      // Remember the new user.
    }

    /**
     * Helper to determine if |userId| is a "new friend" to be added to the
     * roster, and also isn't just our own userId, since we can receive XMPP
     * messages for ourself too.
     */
    private isNewFriend_ = (userId :string) : boolean => {
      return !(userId == this.myInstance.userId) &&
             !(userId in this.roster);
    }

    public restoreFromStorage() {
      // xmpp is weird, so we need to do this.
      storage.keys().then((keys :string[]) => {
        var myKey = this.getStorePath();
        for (var i in keys) {
          if (keys[i].indexOf(myKey) === 0) {
            var userId = keys[i].substr(myKey.length);
            if (this.isNewFriend_(userId)) {
              this.addUser_(userId);
            }
          }
        }
      });
    }

    //===================== Social.Network implementation ====================//

    public login = (remember :boolean) : Promise<void> => {
      var request :freedom_Social.LoginRequest = {
        agent: 'uproxy',
        version: '0.1',
        url: 'https://github.com/uProxy/uProxy',
        interactive: true,
        rememberLogin: remember
      };
      this.onceLoggedIn_ = this.freedomApi_.login(request)
          .then((freedomClient :freedom_Social.ClientState) => {
            // Upon successful login, save local client information.
            this.startMonitor_();
            this.log('logged into uProxy');
            return this.prepareLocalInstance(freedomClient.userId).then(() => {
              this.myInstance.clientId = freedomClient.clientId;
              // Notify UI that this network is online before we fulfill
              // the onceLoggedIn_ promise.  This ensures that the UI knows
              // that the network is online before we send user updates.
              var payload :UI.NetworkMessage = {
                name: this.name,
                online: true,
                userId: freedomClient.userId
              };
              ui.update(uProxy.Update.NETWORK, payload);
            });
          });
      return this.onceLoggedIn_
          .then(() => {
            this.restoreFromStorage();
            ui.showNotification('You successfully signed on to ' + this.name +
                                ' as ' + this.myInstance.userId);
          })
          .catch(() => {
            this.onceLoggedIn_ = null;
            this.error('Could not login.');
            ui.sendError('There was a problem signing in to ' + this.name +
                         '. Please try again.');
            return Promise.reject(new Error('Could not login.'));
          });
    }

    public logout = () : Promise<void> => {
      this.myInstance = null;
      this.stopMonitor_();
      for (var userId in this.roster) {
        this.roster[userId].handleLogout();
      }
      return this.freedomApi_.logout().then(() => {
        this.log('logged out.');
      });
    }

    /**
     * Promise the sending of |msg| to a client with id |clientId|.
     */
    public send = (recipientClientId :string,
                   message :uProxy.Message) : Promise<void> => {
      var messageString = JSON.stringify(message);
      this.log('sending ------> ' + messageString);
      return this.freedomApi_.sendMessage(recipientClientId, messageString);
    }

    // TODO: We should make a class for monitors or generally to encapsulate
    // setInterval/clearInterval calls.  Then we could call monitor.start
    // and monitor.stop.
    private startMonitor_ = () : void => {
      if (this.monitorIntervalId_) {
        // clear any existing monitor
        console.error('startMonitor_ called with monitor already running');
        this.stopMonitor_();
      } else if (this.name == 'Facebook') {
        // Don't monitor (send INSTANCE_REQUEST messages) for Facebook,
        // to minimize spam.
        return;
      }

      var monitorCallback = () => {
        this.log('Running monitor');
        // TODO: if too many instances are missing, we may send more messages
        // than our XMPP server will allow and be throttled.  We should change
        // monitoring to limit the number of XMPP messages it sends on each
        // interval.
        for (var userId in this.roster) {
          this.getUser(userId).monitor();
        }
      };
      this.monitorIntervalId_ = setInterval(monitorCallback, 5000);
    }

    private stopMonitor_ = () : void => {
      if (this.monitorIntervalId_) {
        clearInterval(this.monitorIntervalId_);
      }
      this.monitorIntervalId_ = null;
    }

    public resendInstanceHandshakes = () => {
      for (var userId in this.roster) {
        this.roster[userId].resendInstanceHandshakes();
      }
    }

  }  // class Social.FreedomNetwork


  // A Social.Network implementation that "sends" a message by relaying it to
  // the uProxy UI for display to the user and "receives" a message from the
  // uProxy UI after the user has manually entered (copy/pasted) it into the
  // UI.
  //
  // This network is unusual in that there is no distinction among user IDs,
  // client IDs, and instance IDs; they are all the same thing. The reason is
  // as follows:
  //   - The manual network has no concept of a single user having multiple
  //     clients; the client ID uniquely identifies the user in the manual
  //     network. Thus, a user ID is also a client ID.
  //   - Similarly, there is no concept of a single user having multiple
  //     instances. Each instance is independent and not correlated with other
  //     instances in any way. Thus, an instance ID is also a user ID.
  export class ManualNetwork extends AbstractNetwork {
    constructor(public name :string) {
      super(name);
    }

    //===================== Social.Network implementation ====================//

    public login = (remember :boolean) : Promise<void> => {
      return Promise.resolve<void>();
    }

    public logout = () : Promise<void> => {
      return Promise.resolve<void>();
    }

    public send = (recipientClientId :string,
                   message :uProxy.Message) : Promise<void> => {
      this.log('Manual network sending message; recipientClientId=[' +
               recipientClientId + '], message=' + JSON.stringify(message));
      // TODO: Batch messages.

      // Relay the message to the UI for display to the user.
      ui.update(uProxy.Update.MANUAL_NETWORK_OUTBOUND_MESSAGE, message);

      return Promise.resolve<void>();
    }

    // TODO: Consider adding a mechanism for reporting back to the UI that a
    // message is malformed or otherwise invalid.
    public receive = (senderClientId :string,
                      message :uProxy.Message) : void => {
      this.log('Manual network received incoming message; senderClientId=[' +
               senderClientId + '], message=' + JSON.stringify(message));

      // Client ID and user ID are the same thing in the manual network, so the
      // sender client ID doubles as the sender user ID.
      var senderUserId = senderClientId;

      if (!(senderUserId in this.roster)) {
        this.roster[senderUserId] = new Core.User(this, senderUserId);
      }

      this.getUser(senderUserId).handleMessage(senderUserId, message);
    }

  }  // class ManualNetwork

}  // module Social

function freedomClientToUproxyClient(
  freedomClientState :freedom_Social.ClientState) : UProxyClient.State {
  // Convert status from Freedom style enum value ({'ONLINE': 'ONLINE',
  // 'OFFLINE: 'OFFLINE'}) to TypeScript style {'ONLINE': 4000, 4000: 'ONLINE',
  // 'OFFLINE': 4001, 4001: 'OFFLINE'} value.
  return {
    userId:    freedomClientState.userId,
    clientId:  freedomClientState.clientId,
    status:    UProxyClient.Status[freedomClientState.status],
    timestamp: freedomClientState.timestamp
  };
}
