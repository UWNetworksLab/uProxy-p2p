import social = require('./social');

/**
 * Enumeration of mutually-exclusive view states.
 */
export enum View {
  SPLASH = 0,
  COPYPASTE,
  ROSTER,
  BROWSER_ERROR
}

/**
 * Enumeration of mutually-exclusive UI modes.
 */
export enum Mode {
  GET = 0,
  SHARE
}

/**
 * The primary interface for the uProxy User Interface.
 * Currently, the UI update message types are specified in ui.d.ts.
 */
// TODO: rename UiApi.
export interface UiApi {

  syncUser(UserMessage:social.UserData) : void;
  // TODO: Enforce these types of granular updates. (Doesn't have to be exactly
  // the below)...
  // updateAll(data:Object) : void;
}

