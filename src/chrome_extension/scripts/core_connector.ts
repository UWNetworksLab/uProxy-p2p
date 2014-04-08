/**
 * core_connector.ts
 *
 * Handles all connection and communication with the uProxy Chrome App.
 */
/// <reference path='../../../third_party/DefinitelyTyped/chrome/chrome.d.ts'/>
/// <reference path='../../../node_modules/freedom-typescript-api/interfaces/promise.d.ts' />
/// <reference path='../../interfaces/commands.d.ts' />
/// <reference path='../../interfaces/chrome_glue.ts' />

var UPROXY_CHROME_APP_ID :string = 'fmdppkkepalnkeommjadgbhiohihdhii';
var SYNC_TIMEOUT         :number = 2000;  // milliseconds.

// Status object for connected. This is an object so it can be bound in
// angular. connected = true iff connected to the app which is running
// freedom.
interface StatusObject {
  connected :boolean;
}


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
class ChromeCoreConnector implements uProxy.CoreAPI {

  private appId_   :string;               // ID of target Chrome App.
  private appPort_ :chrome.runtime.Port;  // For speaking to App.

  // Status object indicating whether we're connected to the app.
  public status :StatusObject;

  // A freedom-type indexed object where each key provides a list of listener
  // callbacks: e.g. { type1 :[listener1_for_type1, ...], ... }
  // TODO: Replace with Core -> UI specified update API.
  private listeners_ :{[msgType :string] : Function[]};

  private disconnectPromise_ :Promise<void>;
  private fulfillDisconnect_ :Function;
  private fulfillConnect_ :Function;

  /**
   * As soon as one constructs the CoreConnector, it will attempt to connect.
   */
  constructor(private options_ ?:chrome.runtime.ConnectInfo) {
    this.appId_ = UPROXY_CHROME_APP_ID;
    this.status = { connected: false };
    this.appPort_ = null;
    this.listeners_ = {};

    // Prepare the disconnection promise.
    this.disconnectPromise_ = new Promise<void>((F, R) => {
      this.fulfillDisconnect_ = F;
    });
  }


  // --- Connectivity methods ---

  /**
   * Connect the Chrome Extension to the Chrome App, and continues polling if
   * unsuccessful.
   *
   * Returns a promise fulfilled with the Chrome port upon connection.
   */
  public connect = () : Promise<chrome.runtime.Port> => {
    return this.connect_()
        .then(() => {
          // If connected, stop polling until the next disconnect.
          return this.onceDisconnected()
            .then(this.connect);
        }).catch((e) => {
          // Otherwise, keep polling.
          console.warn('Retrying in ' + (SYNC_TIMEOUT/1000) + 's...');
          setTimeout(this.connect, SYNC_TIMEOUT);
          return Promise.reject(new Error('No connection'));
        });
  }

  /**
   * Promise internal implementation of the connection sequence.
   * Fails if there's no port available on that connector.
   */
  private connect_ = () : Promise<chrome.runtime.Port> => {
    if (this.status.connected) {
      console.warn('Already connected.');
      return Promise.resolve(this.appPort_);
    }
    this.appPort_ = chrome.runtime.connect(this.appId_, this.options_);
    if (!this.appPort_) {
      return Promise.reject(new Error('Unable to connect to App.'));
    }
    console.log('Connected on port ', JSON.stringify(this.appPort_));
    return new Promise<chrome.runtime.Port>((F, R) => {
      // Wait for message from the other side to ACK our connection to Freedom
      // (there is no callback for a runtime connection [25 Aug 2013])
      this.fulfillConnect_ = F;
      var ackConnection = (msg :string) => {
        if (ChromeGlue.HELLO !== msg) {
          R(new Error('Unexpected msg from uProxy Chrome App: ' + msg));
        }
        console.log('Got hello from uProxy Chrome App:' + msg);
        // Replace message listener for the updating mechanism.
        this.appPort_.onMessage.removeListener(ackConnection);
        this.appPort_.onMessage.addListener(this.dispatchFreedomEvent_);
        this.status.connected = true;
        this.fulfillConnect_(this.appPort_);
      };
      // TODO: Make sure the disconnection promise is refreshed.
      this.appPort_.onDisconnect.addListener(this.fulfillDisconnect_);
      this.appPort_.onMessage.addListener(ackConnection);
      // Send 'hi', which should prompt App to respond with ack.
      this.appPort_.postMessage('hi');
    }).catch((e) => {
      // TODO: Clean up the failure handling.
      console.log(e);
      this.status.connected = false;
      this.appPort_ = null;
      return Promise.reject(new Error('Unable to connect to uProxy Chrome App.'));
    });
  }

  /**
   * Returns a promise which is fulfilled when the Core Connector disconnects.
   */
  public onceDisconnected = () : Promise<void> => {
    return this.disconnectPromise_;
  }

  /**
   * Send a message to the Chrome app.
   */
  public send = (type :uProxy.Command, data ?:any) => {
    if (!this.status.connected) {
      console.error('Cannot call |sendToApp| while disconnected from app.');
      return;
    }
    try {
      this.appPort_.postMessage({
        cmd: 'emit',
        type: type,
        data: data
      });
    } catch (e) {
      console.warn('sendToApp: postMessage Failed. Disconnecting.');
      this.onDisconnectedInternal_();
    }
  }

  /**
   * Add the listener callback to be called when we get events of type |t|
   * emitted from the Chrome App.
   * TODO: Replace this with an actual Core->UI update mechanism.
   */
  public on = (type :string, listener :Function) => {
    if (!this.status.connected) {
      console.error('Cannot call |on| on a disconnected CoreStub.');
      return;
    }
    // Attach listener to the event.
    if (!(type in this.listeners_)) {
      this.listeners_[type] = [];
    }
    this.listeners_[type].push(listener);
    try {
      this.appPort_.postMessage({
        cmd: 'on',
        type: type
      });
    } catch (e) {
      console.warn('on: postMessage Failed. Disconnecting.');
      this.onDisconnectedInternal_();
    }
  }


  // --- CoreAPI interface requirements ---

  reset = () => {
    console.log('Resetting.');
    this.send(uProxy.Command.RESET, null);
  }

  sendInstance = (clientId) => {
    // console.log('Sending instance ID to ' + clientId);
    this.send(uProxy.Command.SEND_INSTANCE, clientId);
  }

  modifyConsent = (instanceId, action) => {
    console.log('Modifying consent.', instanceId);
    this.send(uProxy.Command.MODIFY_CONSENT,
      {
        instanceId: instanceId,
        action: action
      }
    );
  }

  start = (instanceId) => {
    console.log('Starting to proxy through ' + instanceId);
    this.send(uProxy.Command.START_PROXYING, instanceId);
  }

  stop = (instanceId) => {
    console.log('Stopping proxy through ' + instanceId);
    this.send(uProxy.Command.STOP_PROXYING, instanceId);
  }

  updateDescription = (description) => {
    console.log('Updating description to ' + description);
    this.send(uProxy.Command.UPDATE_DESCRIPTION, description);
  }

  changeOption = (option) => {
    console.log('Changing option ' + option);
    // this.send(uProxy.Command.CHANGE_OPTION, option);
  }

  login = (network) => {
    this.send(uProxy.Command.LOGIN, network);
  }

  logout = (network) => {
    this.send(uProxy.Command.LOGOUT, network);
  }

  dismissNotification = (userId) => {
    this.send(uProxy.Command.DISMISS_NOTIFICATION, userId);
  }

  /**
   * This function is used as the callback to listen to messages that should be
   * passed to the freedom listeners in the extension.
   */
  private dispatchFreedomEvent_ = (msg :{type :string; data :any}) => {
    if (msg.type in this.listeners_) {
      var handlers :Function[] = this.listeners_[msg.type].slice(0);
      handlers.forEach((handler) => { handler(msg.data); });
    }
  }

  /**
   * Wrapper for disconnection.
   */
  private onDisconnectedInternal_ = () => {
    console.log('Extension got disconnected from app.');
    this.status.connected = false;
    if (this.appPort_) {
      this.appPort_.onDisconnect.removeListener(this.onDisconnectedInternal_);
      // if (this.currentMessageCallback_) {
        // this.appPort_.onMessage.removeListener(this.currentMessageCallback_);
        // this.currentMessageCallback_ = null;
      // }
      this.appPort_.disconnect();
      this.appPort_ = null;
    }
    this.listeners_ = {};
  }

}  // class ChromeCoreConnector
