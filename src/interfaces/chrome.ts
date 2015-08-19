// Chrome Specific

export interface OAuthInfo {
  url :string;
  redirect :string;
  interactive :boolean;
}

// Enums for Chrome App-Extension communication.
// Used when the Extension and App are initiating their connection.
//
// TODO: Eliminate this someday, when we can make uProxy in chrome not be split
// between an app and an extension. Or generalise it to be part of a uproxy-
// backend connectivity checking protocol.
export module ChromeMessage {
  export var CONNECT :string = 'connect';
  export var ACK :string = 'ack';
}
