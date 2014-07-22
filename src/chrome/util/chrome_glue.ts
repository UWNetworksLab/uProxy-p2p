/*
 * chrome_glue.ts
 *
 * Prototype of some typescript constants to keep the communication between
 * Chrome App and Extension together. This file should be included for all code
 * which deals with communication between the app and extension.
 *
 * This file is transferred by a Grunt rule to both the Chrome App and
 * Extensions' script/ folders.
 *
 * TODO: Eliminate this someday, when we can make uProxy in chrome not be split
 * between an app and an extension.
 */
/// <reference path='../../interfaces/lib/chrome/chrome.d.ts'/>

console.log('Loaded Chrome App-Extension Glue.');

module ChromeGlue {

  // Negotiation between Extension and App.
  export var CONNECT :string = 'connect';
  export var ACK :string = 'ack';
}
