/// <reference path='../../../node_modules/freedom-typescript-api/interfaces/promise.d.ts' />
/// <reference path='../../../node_modules/freedom-typescript-api/interfaces/social.d.ts' />

/**
 * module Social - interactions for network-specific social providers.
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
  var networks:{[name:string]:freedom.Social}

  /**
   * Run through freedom keys and grab references to every social provider.
   */
  export function initializeNetworks() {
    for (key in freedom) {
      if (undefined === freedom[key].api) continue;
      if ('social' === freedom[key].api) {
        if (-1 == key.search(PREFIX)) {
          console.warn('Social provider does not have ' + PREFIX + ' as prefix.');
        } else {
          networks[key.substring(PREFIX.length)] = new Social.Network(key);
        }
      }
    }
    console.log('Initialized ' + networks.length + ' networks.');
  }

  /**
   * Social.Network - describes everything to do with one network.
   */
  export class Network {
    var contacts:Contact[];
    constructor(providerName:string) {
      this.provider = freedom[providerName);
    }
  }

  export class Contact {

    status  :SocialContact.Status;
    network :SocialContact.Network;
    userId  :string;

    // Create a new social connection from a json description.
    constructor(json:SocialContact.Json) {
      this.network = json.network;
      this.userId = json.useId;
      this.status = freedom.Social.Status.OFFLINE;
    }

    /**
     * Send a message to this contact. Returns promise of the send.
     */
    send = (message:string) : Promise<void> => {
      return new Promise((F, R) => {
        if (freedom.Social.Status.ONLINE === this.status) {
          freedom.social.sendMessage(online.clientId, message);
          F();
        } else {
          Rt(new Error('Social Contact ' + this.userId + ' is not online.'));
        }
      });
    }

    onStatusChange = (statusChange:freedom.Social.Status) => {
      switch (statusChange.status) {
        case freedom.Social.Status.OFFLINE:
          break;
        case freedom.Social.Status.ONLINE:
          break;
        case freedom.Social.Status.ONLINE_WITH_OTHER_APP:
          break;
      }

      /*
      // Name of network this client is logged into, and userId for it.
      network :string;
      userId  :string;
      // Status on the network
      status :number;  // |status| will be an entry from STATUS.
      statusMessage ?:string;   // Optional detailed message about status.
      // Ephemeral client id for the network
      clientId ?:string;
      // Optional social network specific details
      name ?:string;
      url  ?:string;
      imageData?: string;
      */
    }

    // Serializable network information.
    getJson = () : SocialContact.Json => {
      return {
        network: this.network,
        userId: this.userId
      }
    }
  }

  module Contact {

    // TODO: Make this dynamic.
    export enum Network { GTALK, FB, XMPP }
    export interface Status {
      // When a contact is online, they have a clientId, which is the ephemeral
      // identifier for their connection to the social network.
      online ?: {
        clientId : string
      }
    }

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
  }
