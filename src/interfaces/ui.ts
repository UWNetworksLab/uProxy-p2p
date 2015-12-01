import social = require('./social');

/**
 * Enumeration of mutually-exclusive view states.
 */
export enum View {
  SPLASH = 0,
  COPYPASTE,
  ROSTER,
  BROWSER_ERROR,
  INVITE_USER
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

export enum CopyPasteError {
  NONE = 0,
  BAD_URL, // url is somehow invalid
  LOGGED_IN, // trying to copy+paste while logged in to a network
  UNEXPECTED, // received a url at an invalid time
  FAILED // something about the connection failed
}

export interface DialogButtonDescription {
  text :string;
  dismissive ?:boolean;
  signal ?:string;
}

export interface DialogUserInputData {
  placeholderText :string;
  initInputValue ?:string;
}

export interface DialogDescription {
  heading :string;
  message :string;
  buttons: DialogButtonDescription[];
  userInputData ?:DialogUserInputData;
}
