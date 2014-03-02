// Freedom.SocialApi

/// <reference path='promise.d.ts' />

// Interfaces for social
declare module Freedom.social {
  // TODO(Freedom): would be nice for Freedom to have an enum of all 'valid'
  // event types for each provider. That way code can avoid depending on
  // strings.
  enum EVENT {
    onMessage,       // receives a |IncomingMessage| value
    onRosterUpdate,  // receives a |State| value for a contact.
    onDisconnected   // The user has been disconnected.
  }

  // Status indicates whether a the user or a contact is online, offline, or
  // online with another client which means they can receve chat messages, but
  // are not expected to react to them in whatever way this application does.
  enum Status {
    // Not connected to any social network. There are no guarantees other
    // methods or events will work until the user calls 'login'
    OFFLINE,
    // Online and using the same application (we can send them messages)
    ONLINE,
    // Messages will appear as chat to the client.
    ONLINE_WITH_OTHER_CLIENT,
  }

  // The state of the user, or that of a contact, on the social network.
  interface State {
    status: Status;
    // Name of network this client is logged into, and userId for it.
    // network: string;
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
    // TODO(Freedom): discuss caching - in uProxy we want to be able to have
    // this information even before we connect to the network. So, we want it
    // in uProxy's storage. Do we really want to have it twice?
  }

  // Roster is a map from clientIds to their status
  interface Roster { [clientId: string] : State; }

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
    agent: string;    // Name of the application
    version: string;  // Version of application
    url: string;      // URL of application
    // Prompt user for login. When |interactive === false|, promise fails
    // unless the Social provider has a cached login token/credentials.
    interactive: boolean;
    // When true, social provider will remember the token/credentials.
    rememberLogin: boolean;
    userId?: string;   // optional user Id to login as
  }
}  // declare module Freedom.social


declare module Freedom {
  class social {
    /**
     * Log into the network. Promise succeeds with filled out profile when we
     * are online. This will log the user out of any existing network/userId.
     **/
    login(loginRequest:social.LoginRequest) : Promise<social.State>;

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
     * Forget any tokens/credentials used for logging in with userId.
     **/
    forgetLogin(userId: string) : Promise<void>;
    forgetAllLogins() : Promise<void>;

    // Generic Freedom Event stuff.
    // Bind an event handler to event type |eventType|. Every time |eventType|
    // event is raised, the function |f| will be called.
    on(eventType:string, f:Function);
    // Do a singleton event binding: |f| will only be called once, on the next
    // event of type |eventType|
    once(eventType:string, f:Function);
  }  // class social

}  // declare module Freedom
