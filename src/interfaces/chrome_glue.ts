/*
 * Prototype of some typescript constants to keep the communication between
 * Chrome App and Extension together.
 *
 * This file is transferred by a Grunt rule to both the chrome_app and
 * chrome_extension script/ folders.
 *
 * TODO: Eliminate this someday, when we can make uProxy in chrome not be split
 * between an app and an extension.
 */
module ChromeGlue {

  // Negotiation between Extension and App.
  export var CONNECT :string = 'connect';
  export var ACK :string = 'ack';

  /**
   * Common type for the message payloads sent between the App and the
   * Extension.
   */
  export interface Payload {
    cmd :string;
    type :number;   // Some flavor of Enum, converted to a number.
    data ?:Object;  // Usually JSON.
  }

}
