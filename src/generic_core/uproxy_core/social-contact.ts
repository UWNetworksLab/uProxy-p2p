/// <reference path='../../interfaces/promise.d.ts' />
/// <reference path='../../interfaces/freedom-social-v3.d.ts' />

module SocialNetworks {
  socialProvider: Freedom.social;
}

// SocialConnection Wraps up a Freedom social provider.
class SocialContact {
  status: SocialContact.Status;
  network: SocialContact.Network;
  userId: string;

  // Create a new social connection from a json description.
  constructor(json:SocialContact.Json) {
    this.network = json.network;
    this.userId = json.useId;
    this.status =
  }

  message = (message:string) : Promise<void> => {
    return new Promise((fulfill, reject) => {
      if(online in this.status) {
        socialProvider.sendMessage(online.clientId, message);
        fulfill();
      } else {
        reject(new Error('Social Contact ' + this.userId + ' is not online.'));
      }
    });
  }

  onStatusChange = (statusChange : Freedom.SocialApi.Status) => {
    if(statusChange.status === )

    // Name of network this client is logged into, and userId for it.
    network: string;
    userId: string;
    // Status on the network
    status: number;  // |status| will be an entry from STATUS.
    statusMessage?: string;   // Optional detailed message about status.
    // Ephemeral client id for the network
    clientId?: string;
    // Optional social network specific details
    name?: string;
    url?: string;
    imageData?: string;
  }

  // Serializable network information.
  getJson = () : SocialContact.Json => {
    return {
      network : this.network,
      userId : this.userId
    }
  }
}

module SocialContact {
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
    network : Network;
    // User's ID on the social network (may be obfuscated, e.g. by hangouts)
    userId : string;
    // User's display name
    name : string;
    // User's homepage/URL
    url : string;
    // Image Data URI (e.g. data:image/png;base64,adkwe329...)
    imageData : string;
  }
}
