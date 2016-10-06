/// <reference path='../../../../third_party/typings/index.d.ts' />
/// <reference path='../../../../third_party/firefox/firefox.d.ts' />

/**
 * firefox_connector.ts
 *
 * Handles all connection and communication with the uProxy core and ui..
 */

import * as uproxy_core_api from '../../../interfaces/uproxy_core_api';
import * as browser_connector from '../../../interfaces/browser_connector';
import * as port from './port';

/**
 * Firefox-specific uProxy CoreBrowserConnector implementation.
 */
export default class FirefoxConnector implements browser_connector.CoreBrowserConnector {

  public status :browser_connector.StatusObject;
  public onceConnected :Promise<void>;

  constructor() {
    this.status = { connected: true };
  }

  public connect = () :Promise<void> => {
    this.emit('core_connect');
    this.onceConnected = Promise.resolve();
    return Promise.resolve();
  }

  /**
   * Attach handlers for updates emitted from the uProxy Core.
   */
  public onUpdate = (update :uproxy_core_api.Update, handler :Function) => {
    port.on('' + update, handler);
  }

  /**
   * Send a payload to the uProxyCore
   */
  public send = (payload :browser_connector.Payload,
                 skipQueue :Boolean = false) => {
    port.emit('' + payload.type, {data: payload.data, promiseId: payload.promiseId});
  }

  public restart = () => {
    // TODO implement restart for firefox
    // https://github.com/uProxy/uproxy/issues/751
  }

  private events_ :{[name :string] :Function} = {};

  public on = (name :string, callback :Function) => {
    this.events_[name] = callback;
  }

  private emit = (name :string, ...args :Object[]) => {
    if (name in this.events_) {
      this.events_[name].apply(null, args);
    }
  }

}  // class FirefoxConnector
