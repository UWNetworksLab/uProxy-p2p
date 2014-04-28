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
   *
   * NOTE: All JSON stringify / parse happens automatically through the
   * network's communication methods. The rest of the code should deal purely
   * with the data objects.
   *
   * Furthermore, at the Social.Network level, all communications deal directly
   * with the clientIds. This is because instanceIds occur at the User level, as
   * the User manages the instance <--> client mappings. (see 'user.ts')
   */
  export class Network {

    public roster    :{[name:string]:Core.User};
    public metadata  :any;  // Network name, description, icon, etc.

    private api       :freedom.Social;
    private provider :any;  // Special freedom object which is both a function
                            // and object... cannot typescript.

    // Information about the local login.
    // |myClient| should exist whilst logged in, and should be null whilst
    // logged out.
    private myClient   :freedom.Social.ClientState;
    private myInstance :Core.LocalInstance;
    private online     :boolean;
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
      // TODO(keroserene):
      // Load local instance from storage, or create a new one if this is the
      // first time this uProxy installation, on this device, has interacted
      // with this network.
      var localInstanceExists = false;
      if (!localInstanceExists) {
        this.myInstance = new Core.LocalInstance();
      }
      // TODO: Update these event name-strings when freedom updates to
      // typescript and Enums.
      this.api.on('onUserProfile', this.handleUserProfile);
      this.api.on('onClientState', this.handleClientState);
      this.api.on('onMessage', this.handleMessage);
      console.log('Preparing Social.Network ' + name);
      this.notifyUI();
    }

    /**
     * Wrapper around logging-in to the social-provider. Updates the local
     * client information, and send an update to the UI upon success. Does
     * nothing if already logged on.
     */
    public login = (remember:boolean = false) : Promise<void> => {
      if (this.online) {
        console.warn('Already logged in to ' + this.name);
        return Promise.resolve();
      }
      var request :freedom.Social.LoginRequest = {
        agent: 'uproxy',
        version: '0.1',
        url: 'https://github.com/uProxy/uProxy',
        interactive: true,
        rememberLogin: remember
      }
      return this.api.login(request).then((client:freedom.Social.ClientState) => {
        // Upon successful login, save local client information.
        this.online = true;
        this.myClient = client;
      }).then(this.notifyUI)
        .catch(() => {
          console.warn('Could not login to ' + this.name);
        });
    }

    /**
     * Wrapper around logging-out of the social provider. Does nothing if
     * already logged-out.
     */
    public logout = () : Promise<void> => {
      if (!this.online) {
        console.warn('Already logged out of ' + this.name);
        return Promise.resolve();
      }
      return this.api.logout().then(() => {
        this.online = false;
        this.myClient = null;
        console.log(this.name + ': logged out.');
      }).then(this.notifyUI);
    }

    public getLocalInstance = () : Core.LocalInstance => {
      return this.myInstance;
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

    /**
     * Returns the User corresponding to |userId|.
     */
    public getUser = (userId :string) : Core.User => {
      return this.roster[userId];
    }

    /**
     * Helper which returns the local user's instance ID on this network.
     */
    public getLocalInstanceId = () : string => {
      return this.myInstance.instanceId;
    }

    /**
     * Generate my instance message, to send to other uProxy installations, to
     * inform them that we're also a uProxy installation to interact with.
     */
    private getInstanceHandshake_ = () : uProxy.Message => {
      return {
        type: uProxy.MessageType.INSTANCE,
        data: this.myInstance.getInstanceHandshake()
      }
    }

    /**
     * Notify remote uProxy installation that we are also a uProxy installation.
     *
     * Sends this network's instance handshake to a target clientId.
     * Assumes that clientId is ONLINE.
     *
     * NOTE: This is one of the few cases where we send a Message directly to a
     * |clientId| rather than |instanceId|. This is because there is not yet a
     * known instanceId, and also because this is internal to Social.Network
     * mechanics.
     */
    public sendInstanceHandshake = (clientId:string) : void => {
      // TODO: Should we memoize the instance handshake, or calculate it fresh
      // each time?
      var handshake = this.getInstanceHandshake_();
      this.send(clientId, handshake);
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
      var instancePayload = this.getInstanceHandshake_();
      if (!instancePayload) {
        console.error('Still not ready to construct instance payload.');
        return false;
      }
      this.instanceMessageQueue_.forEach((clientId:string) => {
        console.log('Sending queued instance message to: ' + clientId + '.');
        this.send(clientId, instancePayload);
      });
      this.instanceMessageQueue_ = [];
      return true;
    }

    /**
     * Private send method sends directly to the clientId, because that is what
     * the social provides deal with.
     */
    public send = (clientId:string, msg:uProxy.Message) : Promise<void> => {
      var msgString = JSON.stringify(msg);
      return this.api.sendMessage(clientId, msgString);
    }

  }  // class Social.Network

}  // module Social
