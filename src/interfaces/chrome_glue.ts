/*
 * Prototype of some typescript constants to keep the communication between
 * Chrome App and Extension together.
 * TODO: Eliminate this someday, when we can make uProxy in chrome not be split
 * between an app and an extension.
 */
module ChromeGlue {

  export var HELLO :string = 'hello.';

}
