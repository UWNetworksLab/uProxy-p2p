// Freedom.SocialApi
//
// TODO(Freedom): make Freedom make constant enums consistent with a typescript
// enum.
// TODO(Freedom): how to invalidate / remove user-credentials.

/// <reference path='promise.d.ts' />

// Interfaces for social
declare module Freedom.social {
  // TODO(Freedom): would be nice for Freedom to have an enum of all 'valid'
  // event types for each provider. That way code can avoid depending on
  // strings.
  enum EVENT {
    onMessage, // receives a |IncomingMessage| value
    onState,  // receives a |State| value
  }

  /**
   * Status values that can be returned from an 'onStatus' event, or from
   * |login| and |logout| methods.
  **/
  enum Status: {
    // Not connected to any social network. There are no guarantees other
    // methods or events will work until the user calls 'login'
    OFFLINE,
    // Fetching login credentials or authorization tokens
    AUTHENTICATING,
    // Connecting to the social network
    CONNECTING,
    // Online!
    ONLINE,
    // This client runs the same FreeDOM app as you and is online TODO(Freedom):
    // change the naming of this: you can still send a message to a non-
    // messagble (ONLINE) client.
    // TODO(Freedom): change the naming of this: you can still send a message
    // to a non- messagble (ONLINE) client. Better would be MESSAGABLE =>
    // ONLINE, and ONLINE ==> ONLINE_WITH_OTHER_CLIENT
    MESSAGEABLE,
    // Error with authenticating to the server
    ERR_AUTHENTICATION,
    // Error with connecting to the server
    ERR_CONNECTION,
  };

  /**
   * |State| is used both for the State of the user being connected to the
   * network, and getting thier own information, as well as the status of a
   * roster entry.
   **/
  interface State {
    // Name of network this client is logged into, and userId for it.
    // network: string;
    userId: string;
    // Status on the network
    status: Status;  // |status| will be an entry from STATUS.
    statusMessage?: string;   // Optional detailed message about status.
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
    network: string;      // the network id the message came from.
    toUserId: string;     // userId of user message is to
    toClientId: string;   // clientId of user message is to
    fromUserId: string;   // userId of user message is from
    fromClientId: string; // clientId of user message is from
    message: string;      // message contents
  }

  // A request to login to a specific network as a specific agent
  interface LoginRequest {
    network: string;  //Network name (as emitted by 'onStatus' events)
    agent: string;    //Name of the application
    version: string;  //Version of application
    url: string;      //URL of application
    // Prompt user for login if credentials not cached. Try to automatically
    // if |interactive === false|, promise fails if no details are present.
    interactive: boolean;
  }
}  // declare module Freedom.SocialApi


declare module Freedom {
  class social {

    /**
     * Log into the network (See below for parameters)
     * The |Status| response is guarenteed to have the same |network| and
     * |userId| fields as the |loginRequest|. The |status| field will be either
     * |MESSAGEABLE| or |ERR_AUTHENTICATION| or |ERR_CONNECTION|.
     * If the |status| field is |MESSAGEABLE|, then |clientId| will be specified.
     * If there are other optional fields for this network, then they will also
     * be set in the returned status (although they may be from local cache, not
     * the latest from the network).
     **/
    login(loginRequest:SocialApi.LoginRequest) : Promise<SocialApi.Status>;

    /**
     * Returns all the Status for each roster enrty.
     * Note: the user's own Status will be somewhere in this list.
     **/
    getRoster() : Promise<SocialApi.Roster>;

    /**
     * Send a message to user on your network
     * If the message is sent to a userId, it is sent to all clients
     * If the message is sent to a clientId, it is sent to just that one client
     * If the destination id is not specified or invalid, promise rejects.
     **/
    sendMessage(destinationId:string, message:string) : Promise<void>;

    /**
     * Logs out the specific user of the specified network
     * If |userId| is null, but |network| is not - log out of all accounts on
     * that network.
     * If |network| is null, log out of all accounts on all networks
     * NOTE: after the logout promise, the user status is OFFLINE.
     **/
    logout(network:string, userId:string) : Promise<void>;

    // Generic Freedom Event stuff.
    // Bind an event handler to event type |eventType|. Every time |eventType|
    // event is raised, the function |f| will be called.
    on(eventType:string, f:Function);
    // Do a singleton event binding: |f| will only be called once, on the next
    // event of type |eventType|
    once(eventType:string, f:Function);
  }  // class social

}  // declare module Freedom
