/**
 * user.ts
 *
 * This file defines the uProxy User class. :User is a type relevant both in the
 * Core and the UI, which is why it is in the top-level directory.
 */
/// <reference path='../interfaces/user.d.ts' />
/// <reference path='../interfaces/instance.d.ts' />

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
      this.clients = {};
      // TODO: Decide whether to contain the image, etc.
      this.clientToInstanceMap_ = {};
    }

    /**
     * Handle 'onClientState' events from the social provider, which indicate
     * changes in status such as becoming online, offline.
     * If the clientId specified does not yet exist, add the client to the list.
     * If the userId of state does not match this user, throw an error.
     */
    public handleClientState = (state :freedom.Social.ClientState) => {
      if (state.userId != this.userId) {
        console.error(this.userId +
            'received ClientState with unexpected userId: ' + state.userId);
        return;
      }
      // Check for existence
      if (!(state.clientId in this.clients)) {
        this.clients[state.clientId] = state.status;
      }
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

    /**
     * Remove a client from this User.
     */
    private removeClient_ = (clientId:string) => {
    }
  }  // class User

}  // module uProxy
