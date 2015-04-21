/**
 * firefox_connector.ts
 *
 * Handles all connection and communication with the uProxy core and ui..
 */

/// <reference path='../../../../../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../../../../third_party/typings/firefox/firefox.d.ts' />

import uproxy_core_api = require('../../../interfaces/uproxy_core_api');
import browser_connector = require('../../../interfaces/browser_connector');
import port = require('./port');

/**
 * Firefox-specific uProxy CoreBrowserConnector implementation.
 */
class FirefoxConnector implements browser_connector.CoreBrowserConnector {

  public status :browser_connector.StatusObject;

  constructor() {
    this.status = { connected: true };
    var ready :browser_connector.Payload = {
      cmd: 'emit',
      type: uproxy_core_api.Command.GET_INITIAL_STATE,
      promiseId: 0
    }
    this.send(ready);
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

}  // class FirefoxConnector

export = FirefoxConnector;
