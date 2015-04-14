/**
 * firefox_connector.ts
 *
 * Handles all connection and communication with the uProxy core and ui..
 */

/// <reference path='../../../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../../third_party/firefox/firefox.d.ts' />

import uproxy_types = require('../../../interfaces/uproxy');

var port :ContentScriptPort;

/**
 * Firefox-specific uProxy CoreBrowserConnector implementation.
 */
class FirefoxConnector implements uproxy_types.CoreBrowserConnector {

  public status :StatusObject;

  constructor() {
    this.status = { connected: true };
    var ready :uproxy_types.Payload = {
      cmd: 'emit',
      type: uproxy_types.Command.GET_INITIAL_STATE,
      promiseId: 0
    }
    this.send(ready);
  }


  /**
   * Attach handlers for updates emitted from the uProxy Core.
   */
  public onUpdate = (update :uproxy_types.Update, handler :Function) => {
    port.on('' + update, handler);
  }

  /**
   * Send a payload to the uProxyCore
   */
  public send = (payload :uproxy_types.Payload,
                 skipQueue :Boolean = false) => {
    port.emit('' + payload.type, {data: payload.data, promiseId: payload.promiseId});
  }

  public restart = () => {
    // TODO implement restart for firefox
    // https://github.com/uProxy/uproxy/issues/751
  }

}  // class FirefoxConnector
