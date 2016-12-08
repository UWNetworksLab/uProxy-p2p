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
export var uProxyAppChannel = freedom(
    'generic_core/freedom-module.json',
    <freedom.FreedomInCoreEnvOptions>{
      'logger': 'lib/loggingprovider/freedom-module.json',
      'debug': 'debug',
      'portType': 'worker'
    }
).then((uProxyModuleFactory:OnEmitModuleFactory) => {
  console.log('Core loading complete');
  return uProxyModuleFactory();
});

export function MakeCoreConnector() : CoreConnector {
  let browserConnector = new CordovaCoreConnector({name: 'uproxy-ui-to-core-connector'});
  return new CoreConnector(browserConnector);
}

class CordovaCoreConnector implements browser_connector.CoreBrowserConnector {

  private appChannel :freedom.OnAndEmit<any,any>;

  // Status object indicating whether we're connected to the app.
  public status :browser_connector.StatusObject;

  private fulfillConnect :Function;
  public onceConnected :Promise<void> = new Promise<void>((F, R) => {
    this.fulfillConnect = F;
  });

  constructor(private options ?:chrome.runtime.ConnectInfo) {
    this.status = { connected: false };
    this.appChannel = null;
  }


  // --- Connectivity methods ---

  /**
   * Connect the UI to the Freedom module.
   *
   * Returns a promise fulfilled upon connection.
   */
  public connect = () : Promise<void> => {
    console.log('trying to connect to app');
    if (this.status.connected) {
      console.warn('Already connected.');
      return Promise.resolve();
    }

    return this.setAppChannel().then(() => {
      this.fulfillConnect();
      this.emit('core_connect');
    });
  }

  /**
   * Promise internal implementation of the connection sequence.
   * This relies on ui_context.uProxyAppChannel being created in the core
   * context before connect() is called here in the UI context.
   */
  private setAppChannel = (): Promise<void> => {
    return new Promise<void>((F, R) => {
      uProxyAppChannel.then((channel: any) => {
        this.appChannel = channel;
        F();
      });
    });
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
    if (skipQueue && !this.appChannel) {
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
