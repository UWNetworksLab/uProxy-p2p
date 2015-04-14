
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

// Payloads for crossing the Core -> UI boundary.
export interface NetworkMessage {
  name    :string;
  online  :boolean;
  userId :string;
}

export interface UserProfileMessage {
  userId       :string;
  name         ?:string;
  imageData    ?:string; // Image URI (e.g. data:image/png;base64,adkwe329...)
  url          ?:string;
}

export interface ConsentState {
  localGrantsAccessToRemote :boolean;
  localRequestsAccessFromRemote :boolean;
  remoteRequestsAccessFromLocal :boolean;
  ignoringRemoteUserRequest :boolean;
  ignoringRemoteUserOffer :boolean;
}

export interface InstanceUiData {
  instanceId             :string;
  description            :string;
  localGettingFromRemote :GettingState;
  localSharingWithRemote :SharingState;
  isOnline               :boolean;
  bytesSent              :number;
  bytesReceived          :number;
}

export interface UserMessage {
  network             :string;
  user                :UserProfileMessage;
  consent             :ConsentState;
  offeringInstances   ?:InstanceUiData[];
  allInstanceIds      ?:string[];
  isOnline  :boolean;
}

/**
 * The primary interface for the uProxy User Interface.
 * Currently, the UI update message types are specified in ui.d.ts.
 */
// TODO: rename UiApi.
export interface UiApi {

  syncUser(UserMessage:UserMessage) : void;
  // TODO: Enforce these types of granular updates. (Doesn't have to be exactly
  // the below)...
  // updateAll(data:Object) : void;
}

