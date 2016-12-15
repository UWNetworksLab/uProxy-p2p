/**
 * cordova_core_connector.ts
 *
 * Runs in the UI context, proxying on() and emit() calls to the Freedom app in the
 * core context.
 */

import * as browser_connector from '../../interfaces/browser_connector';
import * as uproxy_core_api from '../../interfaces/uproxy_core_api';

import CoreConnector from '../../generic_ui/scripts/core_connector';

declare const freedom: freedom.FreedomInCoreEnv;

export interface OnEmitModule extends freedom.OnAndEmit<any,any> {};
export interface OnEmitModuleFactory extends
  freedom.FreedomModuleFactoryManager<OnEmitModule> {};

console.log('Loading core');
export var uProxyAppChannelPromise = new Promise<freedom.OnAndEmit<any, any>>((F, R) => {});
// export var uProxyAppChannelPromise = freedom(
//     'generic_core/freedom-module.json',
//     <freedom.FreedomInCoreEnvOptions>{
//       'logger': 'lib/loggingprovider/freedom-module.json',
//       'debug': 'debug',
//       'portType': 'worker'
//     }
// ).then((uProxyModuleFactory:OnEmitModuleFactory) => {
//   console.log('Core loading complete');
//   return uProxyModuleFactory();
// });

export function MakeCoreConnector() : Promise<CoreConnector> {
  return uProxyAppChannelPromise.then((channel) => {
    let browserConnector = new CordovaCoreConnector(
        channel, {name: 'uproxy-ui-to-core-connector'});
    let core = new CoreConnector(browserConnector);
    return core.login({
      network: 'Cloud',
      loginType: uproxy_core_api.LoginType.INITIAL,
    }).then((loginResult) => {
      console.debug(`Logged in to Cloud network. userId: ${loginResult.userId}, instanceId: ${loginResult.instanceId}`);
      return core;
    });
  });
}

class CordovaCoreConnector implements browser_connector.CoreBrowserConnector {
  // Status object indicating whether we're connected to the app.
  public status :browser_connector.StatusObject;

  private fulfillConnect :Function;
  public onceConnected :Promise<void> = new Promise<void>((F, R) => {
    this.fulfillConnect = F;
  });

  constructor(private appChannel: freedom.OnAndEmit<any,any>,
      private options ?:chrome.runtime.ConnectInfo) {
    this.status = { connected: false };
  }


  // --- Connectivity methods ---

  /**
   * Connect the UI to the Freedom module.
   *
   * Returns a promise fulfilled upon connection.
   */
  public connect = () : Promise<void> => {
    console.log('CordovaCoreConnector.connect()');
    if (!this.status.connected) {
      this.fulfillConnect();
      this.emit('core_connect');
      this.status.connected = true;
    }
    return Promise.resolve();
  }

  // --- Communication ---
  /**
   * Attach handlers for updates emitted from the uProxy Core.
   */
  public onUpdate = (update :uproxy_core_api.Update,
      handler :(eventData:any) => void) => {
    this.onceConnected.then(() => {
      var type = '' + update;
      this.appChannel.on(type, handler);
    });
  }

  /**
   * Send a payload to the Chrome app.  Only "emit" messages are allowed.
   * If currently connected to the App, immediately send. Otherwise, queue
   * the message until connection completes.
   * If skipQueue==true, payloads will not be enqueued disconnected.
   */
  public send = (payload :browser_connector.Payload,
                 skipQueue :Boolean = false) => {
    if (payload.cmd !== 'emit') {
       throw new Error('send can only be used for emit');
    }
    if (skipQueue) {
      return;
    }
    this.onceConnected.then(() => {
      this.appChannel.emit('' + payload.type,
          {data: payload.data, promiseId: payload.promiseId});
    });
  }

  public flushQueue = () => {
  }

  public restart() {
  }

  private events :{[name :string] :Function} = {};

  public on = (name :string, callback :Function) => {
    this.events[name] = callback;
  }

  private emit = (name :string, ...args :Object[]) => {
    if (name in this.events) {
      this.events[name].apply(null, args);
    }
  }
}  // class CordovaCoreConnector
