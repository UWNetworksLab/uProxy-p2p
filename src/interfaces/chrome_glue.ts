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

  export var HELLO :string = 'hello.';

}
