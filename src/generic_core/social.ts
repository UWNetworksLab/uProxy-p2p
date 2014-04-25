/**
 * social.ts
 *
 * Interactions for network-specific social providers.
 *
 * To add new social providers, list them as dependencies in the primary
 * uProxy freedom manifest (./uproxy.json) with the 'SOCIAL-' prefix in the
 * name, and 'social' as the API. Then add them to the VALID_NETWORKS list
 * below.
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
/// <reference path='user.ts' />

/// <reference path='../../node_modules/freedom-typescript-api/interfaces/freedom.d.ts' />
/// <reference path='../../node_modules/freedom-typescript-api/interfaces/promise.d.ts' />
/// <reference path='../../node_modules/freedom-typescript-api/interfaces/social.d.ts' />


module Social {

  var PREFIX:string = 'SOCIAL-';
  var VALID_NETWORKS:string[] = [
    'google',
    'websocket',
  ]
  export var networks:{[name:string]:Network} = {}

  /**
   * Run through possible network names and grab references to every social provider.
   */
  export function initializeNetworks(networks:string[] = VALID_NETWORKS) {
    networks.map((name:string) : Network => {
      var dependency = PREFIX + name;
      if (undefined === freedom[dependency]) {
        console.warn(name + ' does not exist as a freedom provider.');
        return;
      }
      if ('social' !== freedom[dependency].api) {
        console.warn(name + ' does not implement the social api.');
        return;
      }
      var network = new Social.Network(name);
      Social.networks[name] = network;
      return network;
    });
    // console.log('Initialized ' + Object.keys(networks).length + ' networks.');
    return Social.networks;
  }

  /**
   * Retrieve reference to the network |networkName|.
   */
  export function getNetwork(networkName:string) : Network {
    if (!(networkName in networks)) {
      console.warn('Network does not exist: ' + networkName);
      return null;
    }
    return networks[networkName];
  }

  /**
   * Social.Network - encapsulates a single network on a social provider.
   *
   * Maintains the local uProxy client's interaction as a user on the network.
   *
   * Also, deals with events from the social provider. 'onUserProfile' events
   * directly affect the roster of this network, while 'onClientState' and
   * 'onMessage' are passed on to the relevant user, assuming the user exists.
   */
  export class Network {

    public roster    :{[name:string]:Core.User};
    public metadata  :any;  // Network name, description, icon, etc.

    private api       :freedom.Social;
    private provider :any;  // Special freedom object which is both a function
                            // and object... cannot typescript.
    // Information about the local login.
    private myClient :freedom.Social.ClientState;
    private online :boolean;
    private instanceMessageQueue_ :string[];  // List of recipient clientIDs.

    // Sometimes we receive other uproxy instances before we've received our own
    // XMPP client state, which means we cannot yet build an instance message.
    private sendInstanceQueue_ :string[] = [];

    /**
     * Initialize the social provider for this Network, and attach event
     * handlers.
     */
    constructor(public name:string) {
      this.provider = freedom[PREFIX + name];
      this.metadata = this.provider.manifest;
      this.roster = {};
      this.online = false;
      this.instanceMessageQueue_ = [];
      this.api = this.provider();
      this.myClient = null;
      // TODO: Update these event name-strings when freedom updates to
      // typescript and Enums.
      this.api.on('onUserProfile', this.handleUserProfile);
      this.api.on('onClientState', this.handleClientState);
      this.api.on('onMessage', this.handleMessage);
      console.log('Preparing Social.Network ' + name);
      this.notifyUI();
    }

    /**
     * Wrapper around logging-in to the social-provider, and updating the local
     * state upon success.
     * TODO: test this.
     */
    public login = (remember:boolean = false) : Promise<void> => {
      var request :freedom.Social.LoginRequest = {
        agent: 'uproxy',
        version: '0.1',
        url: 'https://github.com/uProxy/uProxy',
        interactive: true,
        rememberLogin: remember
      }
      return this.api.login(request).then((client:freedom.Social.ClientState) => {
        // Upon successful login, remember local client information.
        this.online = true;
        this.myClient = client;
      }).then(this.notifyUI);
    }

    public logout = () : Promise<void> => {
      return this.api.logout().then(() => {
        this.online = false;
        console.log(this.name + ': logged out.');
      }).then(this.notifyUI);
    }

    /**
     * Helper which tells the UI about the existence / status of this network.
     */
    public notifyUI = () => {
      var payload :UI.NetworkMessage = {
        name: this.name,
        online: this.online
      }
      ui.update(uProxy.Update.NETWORK, payload);
    }

    /**
     * Handler for receiving 'onUserProfile' messages. First, determines whether
     * the UserProfile belongs to ourselves or a remote contact. Then,
     * updates / adds the user data to the roster.
     * Note that our own Instance Message is specific to one particular network,
     * and can only be prepared after receiving our own vcard for the first
     * time.
     */
    public handleUserProfile = (profile :freedom.Social.UserProfile) => {
      var userId = profile.userId;
      var payload :UI.UserMessage = {
        network: this.name,
        user: profile
      };
      // Check if this is ourself.
      if (this.myClient && userId == this.myClient.userId) {
        console.log('<-- XMPP(self) [' + profile.name + ']\n', profile);
        // Send our own InstanceMessage to any queued-up clients.
        if (freedom.Social.Status.ONLINE == this.myClient.status) {
          this.flushQueuedInstanceMessages();
        }
        // Update UI with own information.
        ui.update(uProxy.Update.USER_SELF, payload);
        return;
      }

      // Otherwise, this is a remote contact...
      console.log('<--- XMPP(friend) [' + profile.name + ']', profile);
      if (!(userId in this.roster)) {
        // console.log('Received new UserProfile: ' + userId);
        this.roster[userId] = new Core.User(this, profile);
      } else {
        this.roster[userId].update(profile);
      }
      // Update UI with friend's information.
      ui.update(uProxy.Update.USER_FRIEND, payload);
    }

    /**
     * Handler for receiving 'onClientState' messages. Passes these messages to
     * the relevant user, which will manage its own clients.
     */
    public handleClientState = (client :freedom.Social.ClientState) => {
      if (!(client.userId in this.roster)) {
        console.warn(
            'network ' + this.name + ' received client state for unexpected ' +
            'userId: ' + client.userId);
        return;
      }
      this.roster[client.userId].handleClient(client);
    }

    /**
     * When receiving a message from a social provider, delegate it to the correct
     * user, which will delegate to the correct client.
     *
     * TODO: it is possible that the roster entry does not yet exist for a user,
     * yet we receive a message from them. Perhaps the right behavior is not to
     * throw away those messages, but to create a place-holder user until we
     * receive more user information.
     */
    public handleMessage = (incoming :freedom.Social.IncomingMessage) => {
      if (!(incoming.from.userId in this.roster)) {
        console.warn(
            'network ' + this.name + ' received message for unexpected ' +
            'userId: ' + incoming.from.userId);
        return;
      }
      var msg :uProxy.Message = JSON.parse(incoming.message);
      this.roster[incoming.from.userId].handleMessage(incoming);
    }

    public getUser = (userId :string) : Core.User => {
      return this.roster[userId];
    }

    /**
     * Generate my instance message, to send to other uProxy installations, to
     * inform them that we're also a uProxy installation to interact with.
     *
     * However, we can only build the instance message if we've
     * received an onClientState event for ourself, to populate at least one
     * identity.
     */
    private prepareInstanceHandshake_ = () : uProxy.Message => {
      return {
        type: uProxy.MessageType.INSTANCE,
        data: this.myClient
      }
    }

    /**
     * Notify remote uProxy installation that we are also a uProxy installation.
     *
     * Sends this network's instance handshake to a target clientId. This is one
     * of the few cases where we send directly to a clientId instead of an
     * instanceId - because there is not yet a known instanceId.
     */
    public sendInstanceHandshake = (clientId:string) : void => {
      // Only send to clientId if it's known to be ONLINE.
      // TODO: Fix the null once we've created our own instance mesage.
      var instanceMessage = 'please-implement-me';
      this.api.sendMessage(clientId, instanceMessage);
    }

    /**
     * Often times, network will receive client IDs belonging to remote
     * contacts known to be uProxy-enabled. This may happen prior to receiving
     * the local vcard, which is required for constructing the local Instance
     * Message. In this case, those instance messages must be queued.
     */
    public flushQueuedInstanceMessages = () => {
      if (0 === this.instanceMessageQueue_.length) {
        return;  // Don't need to do anything.
      }
      var instancePayload = JSON.stringify(this.prepareInstanceHandshake_());
      if (!instancePayload) {
        console.error('Still not ready to construct instance payload.');
        return false;
      }
      this.instanceMessageQueue_.forEach((clientId:string) => {
        console.log('Sending queued instance message to: ' + clientId + '.');
        this.api.sendMessage(clientId, instancePayload);
      });
      this.instanceMessageQueue_ = [];
      return true;
    }

    /**
     * Send a message to one particular instance. Returns promise of the send.
     * Assumes the instance exists.
     * TODO: make this real and test it.
     */
    send = (instanceId:string, message:string) : Promise<void> => {
      console.log('[To be implemented] Network.send(' +
                  instanceId + '): ' + message);
      return new Promise<void>((F, R) => {
        // if (freedom.Social.Status.ONLINE === this.state.status) {
          // this.network.api.sendMessage(this.clientId, message)
              // .then(F);
        // } else {
          // R(new Error('Social Contact ' + this.profile.userId + ' is not online.'));
        // }
      });
    }


  }  // class Social.Network

}  // module Social
