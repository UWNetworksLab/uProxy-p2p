// Freedom.SocialApi

/// <reference path='promise.d.ts' />

// Interfaces for social
declare module Freedom.social {
  // TODO(Freedom): would be nice for Freedom to have an enum of all 'valid'
  // event types for each provider. That way code can avoid depending on
  // strings.
  enum EVENT {
    onMessage, // A message is received.
    onRosterProfile, // someone else's roster is recieved or changes
    onMyProfile, // user's profile is received
    onMyStatus // user's status changes
  }

  // Error numbers for things that can go wrong and be given in an promise
  // rejection.
  //
  // enum ERROR {
  //   ...
  // }

  // Status indicates whether a client is online, offline, or online with
  // another client which means they can receve chat messages, but are not
  // expected to react to them in whatever way this application does.
  enum OnlineState {
    // Not connected.
    OFFLINE,
    // Online with the same application (we can send them messages)
    ONLINE,
    // Messages will appear as chat to the client
    ONLINE_WITH_OTHER_CLIENT,
  }

  // Status of a client connected to a social network.
  interface Status {
    userId: string;
    clientId: string;
    status: OnlineState;
  }

  // The profile of a user on a social network.
  interface Profile {
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
  interface Roster { [userId:string] : Profile; }

  /**
   * Event for an incoming messages
   **/
  interface IncomingMessage {
    // UserID/ClientID/status of user from whom the message comes from.
    from: Status;
    // Message contents.
    message: string;
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
     * Generic Freedom Event stuff. |on| binds an event handler to event type
     * |eventType|. Every time |eventType|  event is raised, the function |f|
     * will be called.
     **/
    // Message type |onMessage| happens when the user receives a message from
    // another contact.
    on(eventType:string, f:Function) : void;
    on(eventType:'onMessage', f:(message:social.IncomingMessage)=>void) : void;
    // Message type |onRosterProfile| events are received when another user's
    // profile is received or when a client changes status.
    on(eventType:'onRosterProfile', f:(profile:social.Profile)=>void) : void;
    // Message type |onMyProfile| events are received when the user's profile
    // changes; e.g. image is received or changes
    on(eventType:'onMyProfile', f:(profile:social.Profile)=>void) : void;
    // Message type |onMyStatus| is received when the user's client's status
    // changes, e.g. when disconnected and online status becomes offline.
    on(eventType:'onMyStatus', f:(status:social.Status)=>void) : void;
    /**
     * Do a singleton event binding: |f| will only be called once, on the next
     * event of type |eventType|. Same events as above.
     **/
    once(eventType:string, f:Function) : void;

    /**
     * Log into the network. The promise succeeds once the user is logged in
     * and gives back the userId and clientId.
     **/
    login(loginRequest:social.LoginRequest) : Promise<social.Status>;

    /**
     * Return the current user state.
     **/
    getMyProfileStatus() : Promise<social.Status>;

    /**
     * Returns the current snapshot of the roster with all current known
     * profiles. Note: the user's own profile will be somewhere in this list.
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
