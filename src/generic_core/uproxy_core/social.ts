/// <reference path='../../../node_modules/freedom-typescript-api/interfaces/promise.d.ts' />
/// <reference path='../../../node_modules/freedom-typescript-api/interfaces/social.d.ts' />

/**
 * Social - interactions for network-specific social providers.
 *
 * To add new social providers, list them as dependencies in the primary
 * uProxy freedom manifest (./uproxy.json) with the 'SOCIAL-' prefix in the
 * name, and 'social' as the API.
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
  export var networks:{[name:string]:Network}

  // Serializable datastructure which only has an additional network field.
  export interface ContactJSON extends freedom.Social.UserProfile {
    network :string;
  }

  /**
   * Run through freedom keys and grab references to every social provider.
   */
  export function initializeNetworks() {
    for (var key in freedom) {
      if (undefined === freedom[key].api) continue;
      if ('social' === freedom[key].api) {
        if (-1 == key.search(PREFIX)) {
          console.warn('Social provider does not have ' + PREFIX + ' as prefix.');
        } else {
          networks[key.substring(PREFIX.length)] = new Social.Network(key);
        }
      }
    }
    console.log('Initialized ' + Object.keys(networks).length + ' networks.');
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
    public contacts  :Contact[];
    public metadata  :any;  // Network name, description, icon, etc.
    private provider :any;  // Special freedom object which is both a function
                            // and contains keys. Cannot typescript-fy.

    constructor(public name:string) {
      this.provider = freedom[name];
      this.metadata = this.provider.manifest;
      this.api = this.provider();  // Instantiate the object.
    }

    /**
     * Add a contact to the network.
     */
    public addContact = () => {
      this.contacts[name] = new Contact(null);
    }
  }

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
  }

  module Contact {

    export interface Status {
      // When a contact is online, they have a clientId, which is the ephemeral
      // identifier for their connection to the social network.
      online ?: {
        clientId : string
      }
    }

    // TODO: Isn't this described in freedom.Social.UserProfile?
    /*
    export interface Json {
      // The network being connected to.
      network :Network;
      // User's ID on the social network (may be obfuscated, e.g. by hangouts)
      userId :string;
      // User's display name
      name :string;
      // User's homepage/URL
      url :string;
      // Image Data URI (e.g. data:image/png;base64,adkwe329...)
      imageData :string;
    }
    */
  }

}  // module Social
