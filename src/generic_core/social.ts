/// <reference path='../../../node_modules/freedom-typescript-api/interfaces/freedom.d.ts' />
/// <reference path='../../../node_modules/freedom-typescript-api/interfaces/promise.d.ts' />
/// <reference path='../../../node_modules/freedom-typescript-api/interfaces/social.d.ts' />

/**
 * Social - interactions for network-specific social providers.
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
module Social {

  var PREFIX:string = 'SOCIAL-';
  var VALID_NETWORKS:string[] = [
    'websocket'
  ]
  export var networks:{[name:string]:Network} = {}

  // Serializable datastructure which only has an additional network field.
  export interface ContactJSON extends freedom.Social.UserProfile {
    network :string;
  }

  /**
   * Run through freedom keys and grab references to every social provider.
   */
  export function initializeNetworks() {
    // for (var key in freedom) {
    VALID_NETWORKS.map((name:string) : Network => {
      var dependency = PREFIX + name;
      console.log(name + ' - ' + dependency);
      if (undefined === freedom[dependency]) return;
      console.log(freedom[dependency]);
      if ('social' !== freedom[dependency].api) return;
      var network = new Social.Network(name);
      Social.networks[name] = network;
      return new Social.Network(name);
    });
    console.log('Initialized ' + Object.keys(networks).length + ' networks.');
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
   */
  export class Network {

    public api       :freedom.Social;
    public contacts  :{[name:string]:Contact};
    public metadata  :any;  // Network name, description, icon, etc.
    private provider :any;  // Special freedom object which is both a function
                            // and contains keys. Cannot typescript-fy.

    constructor(public name:string) {
      console.log('Initializing network ' + name);
      this.provider = freedom[PREFIX + name];
      this.metadata = this.provider.manifest;
      this.api = this.provider();  // Instantiate the object.
    }

    /**
     * Add a contact to the network.
     */
    public addContact = (userid:string) => {
      this.contacts[userid] = new Contact(null);
    }

  }  // class Social.Network

  /**
   * Wrapper around freedom.Social.UserProfile to describe a contact and its
   * interactions on a network.
   */
  export class Contact {

    public statusMessage :string;   // Optional detailed message about status.
    public clientId :string;   // null when offline.
    // clients :freedom.Social.Clients;  // Dict of clientId -> client
    public profile  :ContactJSON;
    public state    :freedom.Social.ClientState;

    // Create a new social connection from a json description.
    constructor(public network:Network) { //json:SocialContact.Json) {
      // TODO: ACtually make this real.
      this.state = {
        userId: 'idunno',
        clientId: 'idunno',
        status: freedom.Social.Status.OFFLINE,
        timestamp: Date.now()
      }
      this.profile = {
        network: network.name,
        userId: 'idunno',
        name: 'person',
        timestamp: Date.now()
      }
    }

    /**
     * Send a message to this contact. Returns promise of the send.
     */
    send = (message:string) : Promise<void> => {
      return new Promise<void>((F, R) => {
        if (freedom.Social.Status.ONLINE === this.state.status) {
          this.network.api.sendMessage(this.clientId, message)
              .then(F);
        } else {
          R(new Error('Social Contact ' + this.profile.userId + ' is not online.'));
        }
      });
    }

    /**
     * Update the client. TODO: make it actually work
     */
    onStatusChange = (statusChange:freedom.Social.ClientState) => {
      switch (statusChange.status) {
        case freedom.Social.Status.OFFLINE:
          break;
        case freedom.Social.Status.ONLINE:
          break;
        case freedom.Social.Status.ONLINE_WITH_OTHER_APP:
          break;
      }
    }

    // Serializable network information.
    getJson = () : freedom.Social.UserProfile => {
      return this.profile;
    }
  }  // class Social.Contact

}  // module Social
