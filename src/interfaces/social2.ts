// TODO: move this file elsewhere..  this was copied from freedom-social-github

// Typescript file for:
// social.github.json

/// <reference path='../../../third_party/typings/es6-promise/es6-promise.d.ts' />

export interface ClientState {
  userId    :string;
  clientId  :string;
  status: string;  // a string from: FreedomSocialProvider.STATUS
  timestamp :number;
}

// The profile of a user on a social network.
export interface UserProfile {
  userId       :string;
  status       ?:number;
  name         ?:string;
  url          ?:string;
  // Image URI (e.g. data:image/png;base64,adkwe329...)
  imageData    ?:string;
  timestamp    ?:number;
}

export interface Users   { [userId:string]   : UserProfile; }
export interface Clients { [clientId:string] : ClientState; }

// Event for an incoming messages
export interface IncomingMessage {
  // UserID/ClientID/status of user from whom the message comes from.
  from     :ClientState;
  // Message contents.
  message  :string;
}

    // A request to login to a specific network as a specific agent
export interface LoginRequest {
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

// Interfaces for Freedom social API
// The Freedom social class
export interface FreedomSocialProvider {
  ERRCODE: {
    SUCCESS: string;
    UNKNOWN: string;
    OFFLINE: string;
    MALFORMEDPARAMETERS: string;
    LOGIN_BADCREDENTIALS: string;
    LOGIN_FAILEDCONNECTION: string;
    LOGIN_ALREADYONLINE: string;
    LOGIN_OAUTHERROR: string;
    SEND_INVALIDDESTINATION: string;
  };

  STATUS: {
    OFFLINE: string;
    ONLINE: string;
    ONLINE_WITH_OTHER_APP: string;
  };

  // Generic Freedom Event stuff. |on| binds an event handler to event type
  // |eventType|. Every time |eventType|  event is raised, the function |f|
  // will be called.
  //
  // Message type |onMessage| happens when the user receives a message from
  // another contact.
  on(eventType:string, f:Function) : void;
  on(eventType:'onMessage', f:(message:IncomingMessage)=>void) : void;
  // Message type |onRosterProfile| events are received when another user's
  // profile is received or when a client changes status.
  on(eventType:'onUserProfile', f:(profile:UserProfile)=>void) : void;
  // Message type |onMyStatus| is received when the user's client's status
  // changes, e.g. when disconnected and online status becomes offline.
  on(eventType:'onClientState', f:(status:ClientState)=>void) : void;

  // Do a singleton event binding: |f| will only be called once, on the next
  // event of type |eventType|. Same events as above.
  once(eventType:string, f:Function) : void;

  login(loginRequest :LoginRequest) : Promise<ClientState>;
  getUsers() : Promise<Users>;
  getClients() : Promise<Clients>;

  acceptUserInvitation(inviteToken :string): Promise<void>;
  inviteUser(optionalUserId :string): Promise<Object>;
  sendEmail(toEmailAddress :string, subject :string, body :string): Promise<void>;

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
}  // interface FreedomSocialProvider
