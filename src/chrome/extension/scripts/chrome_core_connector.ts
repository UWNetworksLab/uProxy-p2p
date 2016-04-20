/**
 * chrome_core_connector.ts
 *
 * Handles all connection and communication with the uProxy Chrome App.
 */
/// <reference path='../../../../../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../../../../third_party/typings/chrome/chrome.d.ts' />
import browser_connector = require('../../../interfaces/browser_connector');
import uproxy_core_api = require('../../../interfaces/uproxy_core_api');
import chrome_api = require('../../../interfaces/chrome');
import ChromeMessage = chrome_api.ChromeMessage;
import Constants = require('../../../generic_ui/scripts/constants');

var UPROXY_CHROME_APP_ID :string = 'fmdppkkepalnkeommjadgbhiohihdhii';
var SYNC_TIMEOUT         :number = 1000;  // milliseconds.

import user_interface = require('../../../generic_ui/scripts/ui');

/**
 * Chrome-Extension-specific uProxy Core API implementation.
 *
 * This class hides all cross App-Extension communication wiring so that the
 * uProxy UI may speak through this connector as if talking directly to Core.
 *
 * Propagates these messages:
 *    Core --[ UPDATES  ]--> UI
 *    UI   --[ COMMANDS ]--> Core
 *
 * Whilst disconnected, this continuously polls Chrome for the existence of the
 * uProxy App, and automatically reconnects if possible. This is designed such
 * that the user (which is the Extension / UI) won't have to deal with
 * connectivity explicitly, but has the option to chain promises if desired.
 */
class ChromeCoreConnector implements browser_connector.CoreBrowserConnector {

  private appId_   :string;                // ID of target Chrome App.
  private appPort_ :chrome.runtime.Port;   // For speaking to App.
  private queue_   :browser_connector.Payload[];  // Queue for outgoing appPort_ msgs.

  // Status object indicating whether we're connected to the app.
  // TODO: Since this is equivalent to whether or not appPort_ is null, we
  // should probably consider turning it into a function, while at the same time
  // preserving potential data bindings.
  public status :browser_connector.StatusObject;

  // A freedom-type indexed object where each key provides a list of listener
  // callbacks: e.g. { type1 :[listener1_for_type1, ...], ... }
  // TODO: Replace with Core -> UI specified update API.
  private listeners_ :{[type :string] : Function};

  private fulfillConnect_ :Function;
  public onceConnected :Promise<void> = new Promise<void>((F, R) => {
    this.fulfillConnect_ = F;
  });

  /**
   * As soon as one constructs the CoreBrowserConnector, it will attempt to connect.
   */
  constructor(private options_ ?:chrome.runtime.ConnectInfo) {
    this.appId_ = UPROXY_CHROME_APP_ID;
    this.status = { connected: false };
    this.appPort_ = null;
    this.queue_ = [];
    this.listeners_ = {};
  }


  // --- Connectivity methods ---

  /**
   * Connect the Chrome Extension to the Chrome App, and continues polling if
   * unsuccessful.
   *
   * Returns a promise fulfilled with the Chrome port upon connection.
   */
  public connect = () : Promise<void> => {
    console.log('trying to connect to app');
    if (this.status.connected) {
      console.warn('Already connected.');
      return Promise.resolve<void>();
    }

    return this.connect_().then(this.flushQueue).then(() => {
      // Connect/reconnect listeners to app.  These will not have been queued,
      // in order to prevent duplicate requests, and will need to be re-sent
      // after each successful reconnection to the app.
      for (var type in this.listeners_) {
        // Convert type from string back to number (uproxy_core_api.Update enum) for
        // payload to app.
        var payload = {
          cmd: 'on',
          type: parseInt(type, 10)
        };
        console.log('Connecting listener for', JSON.stringify(payload));
        this.send(payload);
      }

      this.emit('core_connect');
    });
  }

  /**
   * Promise internal implementation of the connection sequence.
   * Fails if there's no port available on that connector.
   */
  private connect_ = () : Promise<chrome.runtime.Port> => {
    this.appPort_ = chrome.runtime.connect(this.appId_, this.options_);
    if (!this.appPort_) {
      // This code is just a sanity check and not expected to be hit.  Even
      // if the app is not running, this.appPort_ will still be set,
      // but the onDisconnect even will be fired.
      console.warn('connect_: Unable to connect to create this.appPort_.');
      // Manually invoke disconnect handler which will retry connection.
      this.onDisconnectHandler_();
      return Promise.reject(new Error('Unable to connect to App.'));
    }

    // Immediately setup disconnect handler, which will be invoked both on a
    // real disconnect and in the case where a connection could not be setup.
    this.appPort_.onDisconnect.addListener(this.onDisconnectHandler_);

    return new Promise<chrome.runtime.Port>((F, R) => {
      // Wait for message from the other side to ACK our connection to Freedom
      // (there is no callback for a runtime connection [25 Aug 2013])
      var ackResponse = (msg :string) => {
        console.log('connect_: in ackResponse');
        if (ChromeMessage.ACK !== msg) {
          R(new Error('Unexpected msg from uProxy App: ' + msg));
        }
        // Replace message listener for the updating mechanism.
        // TODO: Merge the ack-response into the same format as the other
        // payloads so that we don't need to swap out the handler.
        console.log(this.appPort_);
        this.appPort_.onMessage.removeListener(ackResponse);
        this.appPort_.onMessage.addListener(this.receive_);
        this.status.connected = true;
        // Once connected, the extension popup should show its start page.
        chrome.browserAction.setIcon({
          path: {
            "19": "icons/19_" + Constants.LOGGED_OUT_ICON,
            "38": "icons/38_" + Constants.LOGGED_OUT_ICON
          }
        });
        this.fulfillConnect_();
        F(this.appPort_);
      };
      this.appPort_.onMessage.addListener(ackResponse);
      // Send 'hi', which should prompt App to respond with ack.
      this.appPort_.postMessage(ChromeMessage.CONNECT);
    }).catch((e) => {
      console.log(e);
      // Retry connection.
      console.warn('Retrying connection in ' + (SYNC_TIMEOUT/1000) + 's...');
      setTimeout(this.connect, SYNC_TIMEOUT);
      return Promise.reject(new Error('Unable to connect to uProxy App.'));
    });
  }

  private onDisconnectHandler_ = () => {
    // Note this is invoked both when a connection to the app was established
    // and then disconnected, and when a connection to the app could not
    // be establish (i.e. this.appPort_.postMessage in connect_ failed).
    console.log('Disconnected from app, previous status was ' +
                this.status.connected);

    this.emit('core_disconnect');

    if (this.status.connected) {
      this.status.connected = false;
      this.onceConnected = new Promise<void>((F, R) => { this.fulfillConnect_ = F; });
    }

    // Update this.appPort_ to ensure we are disconnected.
    this.appPort_ = null;

    console.warn('Retrying connection in ' + (SYNC_TIMEOUT/1000) + 's...');
    setTimeout(this.connect, SYNC_TIMEOUT);
  }

  // --- Communication ---
  /**
   * Attach handlers for updates emitted from the uProxy Core.
   *
   * These handlers persist through disconnections and reconnections, and may be
   * installed whether or not the Extension is currently connected to the App.
   */
  public onUpdate = (update :uproxy_core_api.Update, handler :Function) => {
    var type = '' + update;
    var alreadyHooked = typeof this.listeners_[type] !== 'undefined';
    // This is called every time we open a popup in chrome.
    // New handlers need to replace old handlers.
    this.listeners_[type] = handler;
    if (!alreadyHooked) {
      var payload = {
        cmd: 'on',
        type: update
      };
      // This log floods the console during testing. Uncomment for debugging.
      // console.log('UI onUpdate for', JSON.stringify(payload));
      this.send(payload, true);
    }
  }

  /**
   * Send a payload to the Chrome app.
   * If currently connected to the App, immediately send. Otherwise, queue
   * the message for the next successful connection.
   * If skipQueue==true, payloads will not be enqueued when app is disconnected.
   */
  public send = (payload :browser_connector.Payload,
                 skipQueue :Boolean = false) => {
    if (!this.status.connected || null == this.appPort_) {
      if (!skipQueue) {
        this.queue_.push(payload);
      }
      return;
    }
    try {
      this.appPort_.postMessage(payload);
    } catch (e) {
      console.warn(e);
      console.warn('ChromeConnector.send postMessage failure.');
    }
  }

  /**
   * Receive messages from the chrome.runtime.Port.
   * These *must* some form of uproxy_core_api.Update.
   */
  private receive_ = (msg :{type :string; data :any}) => {
    if (msg.type in this.listeners_) {
      this.listeners_[msg.type](msg.data);
      // TODO: Fire a DOM update? Decide if this should happen here or during a
      // ui.sync call.
    }
  }

  /**
   * Helper which sends all payloads currently on the queue over to the Chrome
   * App. Should be called everytime connection is renewed.
   */
  public flushQueue = (port?:chrome.runtime.Port) => {
    while (0 < this.queue_.length) {
      // Stop flushing if disconnected.
      if (!this.status.connected) {
        console.warn('Disconnected from App whilst flushing queue.');
        break;
      }
      var payload = this.queue_.shift();
      this.send(payload);
    }
    return port;
  }

  public restart() {
    var restart :browser_connector.Payload = {
      cmd: 'emit',
      type: uproxy_core_api.Command.RESTART,
      promiseId: 0
    }
    this.send(restart);
    chrome.runtime.reload();
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
}  // class ChromeConnector

export = ChromeCoreConnector
