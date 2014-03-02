// Freedom.SocialApi
//
// TODO(Freedom): make Freedom make constant enums consistent with a typescript
// enum.
// TODO(Freedom): how to invalidate / remove user-credentials.

/// <reference path='promise.d.ts' />

// Freedom.social static
declare module Freedom.SocialApi {
  enum EVENT {
    onChange,  // receives a |RosterChange| value
    onMessage, // receives a |IncomingMessage| value
    onStatus,  // receives a |Status| value
  }

  /**
   * Define a <client card>, as the following:
   * - Information related to a specific device or client of a user
   **/
  interface Client {
   // Unique ID of client (e.g. alice@gmail.com/Android-23nadsv32f)
   clientId : string;
   // Name of network this client is logged into
   network : string;
   // Status of the client. See the 'STATUS_CLIENT' constants.
   // TODO(Freedom): once freedom uses enums; this can be enum type.
   status : number;
  }

  /**
   * Define a <user card>, as the following: - Information related to a specific
   * user, who may have multiple client devices
   **/
  interface User {
    userId : string;
    name ?: string;
    url ?: string;
    imageData ?: string;
    clients: { [clientId:string]:Client; };
  }

  // Roster is a map from clientIds to their status
  interface Roster {[userId : string] : User}

  interface RosterChange {
    userId : string;     // Unique identifier of the user (e.g. alice@gmail.com)
    name : string;       // Display name (e.g. Alice Foo)
    url : string;        // Homepage URL (e.g. https://alice.com)
    // Image Data URI (e.g. data:image/png;base64,adkwe329...)
    imageData : string;
    // Clients of clients keyed by clientId
    clients : { [clientId:string]:Client; };
  }

  /**
   * Event that is sent on changes to a <user card>
   * (for either yourself or one of your friends)
   * This event must match the schema for an entire <user card> (see above)
   *
   * Current contract is that clients grows monotonically, when clients go
   * offline, they are kept in the clients and have |status| "offline".
   **/
  // Status of a network/userId/ClientId. Also used for the user's status once
  // they join the network.
  interface Status {
    network: string;  // Name of the network (chosen by social provider)
    userId: string;   // userId of myself on this network
    clientId: string; // clientId of my client on this network
    status: number;   // One of the constants defined in 'STATUS_NETWORK'
    message: string;   // More detailed message about status
  }

  /**
   * Event for an incoming messages
   **/
  interface IncomingMessage {
    fromUserId: string;   // userId of user message is from
    fromClientId: string; // clientId of user message is from
    toUserId: string;     // userId of user message is to
    toClientId: string;   // clientId of user message is to
    network: string;      // the network id the message came from.
    message: string;      // message contents
  }

  // A request to login to a specific network as a specific agent
  interface LoginRequest {
    network: string;  //Network name (as emitted by 'onStatus' events)
    agent: string;    //Name of the application
    version: string;  //Version of application
    url: string;      //URL of application
    // TODO(Freedom): freedom should use javascript types! boolean not bool.
    interactive: boolean; //Prompt user for login if credentials not cached?
  }

}  // declare module Freedom.SocialApi

declare module Freedom {
  class social {
    /**
     * List of error codes that can be returned in 'onStatus'
     * events. Because 'login' and 'logout' methods turn 'onStatus'
     * events, those use the same codes
    **/
    static STATUS_NETWORK: {
      // Not connected to any social network. There are no guarantees other
      // methods or events will work until the user calls 'login'
      OFFLINE: number;
      // Fetching login credentials or authorization tokens
      AUTHENTICATING: number;
      // Connecting to the social network
      CONNECTING: number;
      // Online!
      ONLINE: number;
      // Error with authenticating to the server
      ERR_AUTHENTICATION: number;
      // Error with connecting to the server
      ERR_CONNECTION: number;
    }

    static STATUS_CLIENT: {
      // Not logged in
      OFFLINE: number;
      // This client is online, but does not run the same app
      // (i.e. can be useful to invite others to your FreeDOM app)
      ONLINE: number;
      // This client runs the same FreeDOM app as you and is online TODO(Freedom):
      // change the naming of this: you can still send a message to a non-
      // messagble (ONLINE) client.
      MESSAGEABLE: number;
    }

    /**
     * Log into the network (See below for parameters) e.g. social.login(Object
     * options) TODO(Freedom): explain relationship between returned onStatus and
     * login. e.g. will the be on the same network? etc.
     **/
    login(loginRequest:SocialApi.LoginRequest)
        : Promise<SocialApi.Status>;

    /**
     * Returns all the <user card>s that we've seen so far (from 'onChange' events)
     * Note: the user's own <user card> will be somewhere in this list
     **/
    getRoster() : Promise<SocialApi.Roster>;

    /**
     * Send a message to user on your network
     * If the message is sent to a userId, it is sent to all clients
     * If the message is sent to a clientId, it is sent to just that one client
     * If the destination is not specified or invalid, the message is dropped
     * TODO(Freedom): better to have success/fail value returned?
     **/
    sendMessage(destinationId:string, message:string) : Promise<void>;

    /**
     * Logs out the specific user of the specified network
     * If userId is null, but network is not - log out of all accounts on that network
     * If networkName is null, but userId is not - log out of that account
     * TODO(this is not necessarily well defined, the userId does not uniquely
     * specify a network):
     * If both fields are null, log out of all accounts on all networks
     **/
    logout(network:string, userId:string) : Promise<SocialApi.Status>;

    // Generic Freedom Event stuff.
    // Bind an event handler to event type |eventType|. Every time |eventType|
    // event is raised, the function |f| will be called.
    on(eventType:string, f:Function);
    // Do a singleton event binding: |f| will only be called once, on the next
    // event of type |eventType|
    once(eventType:string, f:Function);
  }  // class social
}  // declare module Freedom
