// Typescript file for:
// https://www.github.com/freedomjs/freedom/interface/social.js

/// <reference path="../../../build/third_party/typings/es6-promise/es6-promise.d.ts" />

// declare module freedom {
  declare module freedom_Social {
    // TODO(Freedom): would be nice for Freedom to have an enum of all 'valid'
    // event types for each provider. That way code can avoid depending on
    // strings.
    //
    // TODO: would be nice for freedom to have better constants/enum interface.
    //
    // Freedom errors that may happen during login, etc. At the moment Freedom
    // represent these as strings.
    var ERRCODE :{
      LOGIN_BADCREDENTIALS :string;
      LOGIN_FAILEDCONNECTION :string;
      LOGIN_ALREADYONLINE :string;
      SEND_INVALIDDESTINATION :string;
    }

    // Status of a client connected to a social network.
    interface ClientState {
      userId    :string;
      clientId  :string;
      status    :string;  // Either ONLINE, OFFLINE, or ONLINE_WITH_OTHER_APP
      timestamp :number;
    }

    // The profile of a user on a social network.
    interface UserProfile {
      userId       :string;
      name         ?:string;
      url          ?:string;
      // Image URI (e.g. data:image/png;base64,adkwe329...)
      imageData    ?:string;
      timestamp    ?:number;
    }

    interface Users   { [userId:string]   : UserProfile; }
    interface Clients { [clientId:string] : ClientState; }

    // Event for an incoming messages
    interface IncomingMessage {
      // UserID/ClientID/status of user from whom the message comes from.
      from     :ClientState;
      // Message contents.
      message  :string;
    }

    // A request to login to a specific network as a specific agent
    interface LoginRequest {
      // Name of the application connecting to the network. Other logins with
      // the same agent field will be listed as having status |ONLINE|, where
      // those with different agents will be listed as
      // |ONLINE_WITH_OTHER_CLIENT|
      agent          :string;
      // Version of application
      version        :string;
      // URL of application
      url            :string;
      // When |interactive === true| social will always prompt user for login.
      // Promise fails if the user did not login or provided invalid
      // credentials. When |interactive === false|, promise fails unless the
      // social provider has  cached tokens/credentials.
      interactive    :boolean;
      // When true, social provider will remember the token/credentials.
      rememberLogin  :boolean;
    }
  }  // declare module Social

  // Interfaces for Freedom social API
  // The Freedom social class
  interface freedom_Social {
    // Generic Freedom Event stuff. |on| binds an event handler to event type
    // |eventType|. Every time |eventType|  event is raised, the function |f|
    // will be called.
    //
    // Message type |onMessage| happens when the user receives a message from
    // another contact.
    on(eventType:string, f:Function) : void;
    on(eventType:'onMessage', f:(message:freedom_Social.IncomingMessage)=>void) : void;
    // Message type |onRosterProfile| events are received when another user's
    // profile is received or when a client changes status.
    on(eventType:'onUserProfile', f:(profile:freedom_Social.UserProfile)=>void) : void;
    // Message type |onMyStatus| is received when the user's client's status
    // changes, e.g. when disconnected and online status becomes offline.
    on(eventType:'onClientState', f:(status:freedom_Social.ClientState)=>void) : void;

    // Do a singleton event binding: |f| will only be called once, on the next
    // event of type |eventType|. Same events as above.
    once(eventType:string, f:Function) : void;

    login(loginRequest:freedom_Social.LoginRequest) : Promise<freedom_Social.ClientState>;
    getUsers() : Promise<freedom_Social.Users>;
    getClients() : Promise<freedom_Social.Clients>;

    // Send a message to user on your network
    // If the message is sent to a userId, it is sent to all clients
    // If the message is sent to a clientId, it is sent to just that one client
    // If the destination id is not specified or invalid, promise rejects.
    sendMessage(destinationId:string, message:string) : Promise<void>;

    // Logs the user out of the social network. After the logout promise, the
    // user status is OFFLINE.
    logout() : Promise<void>;

    // Forget any tokens/credentials used for logging in with the last used
    // userId.
    clearCachedCredentials() : Promise<void>;
  }  // class social

//} // declare module freedom
