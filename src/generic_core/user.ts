/**
 * user.ts
 *
 * This file defines the uProxy User class. :User is a type relevant both in the
 * Core and the UI, which is why it is in the top-level directory.
 */
/// <reference path='../interfaces/user.d.ts' />
/// <reference path='../interfaces/instance.d.ts' />



// Status of a client; used for both this client (in which case it will be
// either ONLINE or OFFLINE)
module freedom.Social {
  export enum Status {
    OFFLINE = 4000,
    // This client runs the same freedom.js app as you and is online
    ONLINE,
    // This client is online, but not with the same application/agent type
    // (i.e. can be useful to invite others to your freedom.js app)
    ONLINE_WITH_OTHER_APP,
  }
}


module Core {

  /**
   * Core.User
   *
   * Maintains a mapping between clientIds and instanceIds, while handling
   * messages from its social provider.
   */
  export class User implements BaseUser {

    public name :string;
    public userId :string;
    public clients;
    private clientToInstanceMap_ :{ [clientId :string] :Instance };

    /**
     * Users are constructed when receiving a :UserProfile message from the
     * social provider.
     */
    constructor(private profile :freedom.Social.UserProfile) {
      this.name = profile.name;
      this.userId = profile.userId;
      // TODO: Decide whether to contain the image, etc.
      this.clientToInstanceMap_ = {};
    }

    /**
     * Handle 'onClientState' events from the social provider, which indicate
     * changes in status such as becoming online, offline.
     * If the clientId specified does not yet exist, add the client to the list.
     */
    public handleClientState = (state :freedom.Social.ClientState) => {
      // check.
    }

    /**
     * Handle 'onMessage' events from the social provider, which can be any type
     * of message from another contact.
     */
    public handleMessage = (msg :freedom.Social.IncomingMessage) => {
    }

    /**
     * Maintain a mapping between clientIds and instanceIds.
     */
    private clientToInstance = () => {
    }

  }  // class User

}  // module uProxy
