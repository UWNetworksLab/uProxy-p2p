// Freedom.SocialApi

/// <reference path='promise.d.ts' />

// Interfaces for social
declare module Freedom.social {
  // TODO(Freedom): would be nice for Freedom to have an enum of all 'valid'
  // event types for each provider. That way code can avoid depending on
  // strings.
  enum EVENT {
    onMessage,       // receives a |IncomingMessage| value
    onRosterUpdate,  // receives a new |RosterEntry| value for a contact
    onUserUpdate     // receives a new |UserState| value for the user
  }

  // The state of the user, or that of a contact, on the social network
  interface UserState {
    // Is the user online
    online: boolean;
    // The userId for the chat network
    userId: string;
    // Ephemeral client id for the network
    clientId?: string;
    // Optional social network specific details
    // Name of the user.
    name?: string;
    // Homepage URL (e.g. https://alice.com)
    url?: string;
    // Image Data URI (e.g. data:image/png;base64,adkwe329...)
    imageDataUri?: string;
  }

  // Status indicates whether a client is online, offline, or online with
  // another client which means they can receve chat messages, but are not
  // expected to react to them in whatever way this application does.
  enum Status {
    // Not connected to any social network. There are no guarantees other
    // methods or events will work until the user calls 'login'
    OFFLINE,
    // Online and using the same application (we can send them messages)
    ONLINE,
    // Messages will appear as chat to the client
    ONLINE_WITH_OTHER_CLIENT,
  }

  // The state of a contact on the social network.
  interface RosterEntry {
    // The userId for the chat network
    userId: string;
    // Optional social network specific details
    // Name of the user.
    name?: string;
    // Homepage URL (e.g. https://alice.com)
    url?: string;
    // Image Data URI (e.g. data:image/png;base64,adkwe329...)
    imageDataUri?: string;
    // All clients & their status. Offline clients will be listed as offline,
    // and the next time a roster event is fired, they will not be listed.
    clients: { [clientId:string] : Status }
  }

  // Roster is a map from userIds to the relevant rosterEntry
  interface Roster { [userId:string] : RosterEntry; }

  /**
   * Event for an incoming messages
   **/
  interface IncomingMessage {
    toUserId: string;     // userId of user message is to
    toClientId: string;   // clientId of user message is to
    fromUserId: string;   // userId of user message is from
    fromClientId: string; // clientId of user message is from
    message: string;      // message contents
  }

  // A request to login to a specific network as a specific agent
  interface LoginRequest {
    // Name of the application connecting to the network. Other logins with the
    // same agent field will be listed as having status |ONLINE|, where those
    // with different agents will be listed as |ONLINE_WITH_OTHER_CLIENT|
    agent: string;
    // Version of application
    version: string;
    // URL of application
    url: string;
    // When |interactive === true| social will always prompt user for login.
    // Promise fails if the user did not login or provided invalid credentials.
    // When |interactive === false|, promise fails unless the social provider
    // has  cached tokens/credentials.
    interactive: boolean;
    // When true, social provider will remember the token/credentials.
    rememberLogin: boolean;
    // Optional user Id to login as.
    userId?: string;
  }
}  // declare module Freedom.social


declare module Freedom {
  class social {
    /**
     * Forms of usage for events:
     *   on(EVENT.onMessage, handler: (UserState) => void);
     *   on(EVENT.onRosterUpdate, handler: (RosterEntry) => void);
     *   on(EVENT.onUserUpdate, handler: (IncomingMessage) => void);
     **/

    /**
     * Generic Freedom Event stuff.
     * Bind an event handler to event type |eventType|. Every time |eventType|
     *  event is raised, the function |f| will be called.
     **/
    on(eventType:string, f:Function);

    /**
     * Do a singleton event binding: |f| will only be called once, on the next
     * event of type |eventType|
     **/
    once(eventType:string, f:Function);

    /**
     * Log into the network. The promise succeeds once the user is logged in,
     * and online, and the state is known. The state value in the successful
     * promise is guarenteed to be filly filled out. Note: this will log the
     * user out of any existing userId, and if the last userId is different to
     * the current one, the social provider gaurentees that the old credentials
     * are no longer in the social provider's cache (any subsiquent attempts at
     * logging in with loginRequest.interactive=false will fail if credentials
     * are needed).
     **/
    login(loginRequest:social.LoginRequest) : Promise<social.UserState>;

    /**
     * Return the current user state.
     **/
    getUserState() : Promise<social.UserState>;

    /**
     * Returns all the Status for each roster enrty.
     * Note: the user's own Status will be somewhere in this list.
     **/
    getRoster() : Promise<social.Roster>;

    /**
     * Send a message to user on your network
     * If the message is sent to a userId, it is sent to all clients
     * If the message is sent to a clientId, it is sent to just that one client
     * If the destination id is not specified or invalid, promise rejects.
     **/
    sendMessage(destinationId:string, message:string) : Promise<void>;

    /**
     * Logs the user out of the social network.
     * After the logout promise, the user status is OFFLINE.
     **/
    logout() : Promise<void>;

    /**
     * Forget any tokens/credentials used for logging in with the last used
     * userId.
     **/
    clearCachedCredentials() : Promise<void>;
  }  // class social

}  // declare module Freedom
