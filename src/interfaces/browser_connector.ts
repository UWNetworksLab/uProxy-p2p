import * as uproxy_core_api from './uproxy_core_api';

// Status object for connected. This is an object so it can be bound in
// angular. connected = true iff connected to the app which is running
// freedom.
// TODO: this is chrome-specific. Move to the right place.
export interface StatusObject {
  connected :boolean;
}

/**
 * Common type for the message payloads sent between uProxy backend and ui.
 */
export interface Payload {
  cmd :string;
  type :number;   // Some flavor of Enum, converted to a number.
  data ?:Object;  // Usually JSON.
  promiseId ?:number;  // Values >= 1 means success/error should be returned.
}

// PromiseCommand is used when the UI makes requests to the Core which
// require a promise to be returned. Because many requests can be made, the
// UI needs to distinguish between them. The `promiseId` allows keeping track
// of which command was issued. e.g. consider the user clicking to login to
// multiple networks; we want the UI to know when each login completes.
//
// TODO: when freedom supports multiple runtime enviroments, this code should
// be able to be removed.
export interface PromiseCommand {
  data ?:Object;  // Usually JSON.
  promiseId :number;  // Values <= 1 means success/error should be returned.
}


/**
 * Interface for browser specific backend - ui connector.
 */
export interface CoreBrowserConnector {
  send(payload :Payload, skipQueue ?:Boolean) : void;

  onUpdate(update :uproxy_core_api.Update, handler :Function) : void;

  restart() : void;

  connect() :Promise<void>;

  on(name :string, callback :Function) :void;
  on(name :'core_connect', callback :() => void) :void;
  on(name :'core_disconnect', callback :() => void) :void;

  status :StatusObject;
  onceConnected :Promise<void>;
}
