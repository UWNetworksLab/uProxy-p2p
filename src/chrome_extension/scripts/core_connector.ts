/**
 * core_stub.ts
 *
 * Provides 'CoreStub' object that acts like freedomos.org
 * freedom object, but posts/listens to messages from freedom via a chrome.
 * runtime.message.
 *
 * |id| is the chrome extension/app Id that is running Freedom that we
 *   should speak to.
 * |options| is the options passed the runtime connection. It has a 'name'
 *   field that can be used to name the connection to the freedom component.
 *
 */
/// <reference path='../../../third_party/DefinitelyTyped/chrome/chrome.d.ts'/>
/// <reference path='../../../node_modules/freedom-typescript-api/interfaces/promise.d.ts' />
/// <reference path='../../interfaces/commands.d.ts' />
/// <reference path='../../interfaces/chrome_glue.ts' />

var UPROXY_CHROME_APP_ID :string = 'fmdppkkepalnkeommjadgbhiohihdhii';
var SYNC_TIMEOUT         :number = 4000;  // milliseconds.

// Status object for connected. This is an object so it can be bound in
// angular. connected = true iff connected to the app which is running
// freedom.
interface StatusObject {
  connected :boolean;
}


/**
 * Handles communication with the App.
 */
class ChromeCoreConnector implements uProxy.CoreAPI {

  // Status object whose connected boolean property indicates if we are
  // connected to the app.
  public status :StatusObject;
  // A callback |function() {...}| to call when we are disconnected. e.g. when
  // Freedom extension/app is removed/disabled.
  private onDisconnected :chrome.Event;
  // A callback |function() {...}| to call when connected.
  private onConnected :chrome.Event;

  // ID of Chrome App to connect to.
  private appId_ :string;
  // Options for connection to chrome app containing optional name param.
  private options_ :chrome.runtime.ConnectInfo;
  // A freedom-type indexed object where each key provides a list of listener
  // callbacks: e.g. { type1 :[listener1_for_type1, ...], ... }
  private listeners_ :{[msgType :string] : Function[]};
  // The chrome.runtime.Port used to speak to the App/Extension running Freedom.
  private port_ :chrome.runtime.Port;

  // Used to remember the callback we need to remove. Because we typically need
  // to bind(this), it's useful to name the callback after the bind so we can
  // actually remove it again.
  private currentMessageCallback_ :Function;
  private currentDisconnectCallback_ :Function;

  constructor(options :Object) {
    this.appId_ = UPROXY_CHROME_APP_ID;
    this.options_ = options;
    this.onDisconnected = new chrome.Event();
    this.onConnected = new chrome.Event();
    this.status = { connected: false };
    this.port_ = null;
    this.listeners_ = {};
    this.currentMessageCallback_ = null;
    this.currentDisconnectCallback_ = null;
    // Begin connection check polling.
    this.checkAppConnection_();
  }

  public setConnectionHandler = (handler :Function) => {
    console.log('Attached connection handler ', handler);
    this.onConnected.addListener(handler);
  }

  public setDisconnectionHandler = (handler :Function) => {
    this.onDisconnected.addListener(handler);
  }

  /**
   * Connect the Chrome Extension to the Chrome App.
   * Returns a promise fulfilled with the Chrome port upon connection.
   */
  public connect = () : Promise<chrome.runtime.Port> => {
    if(this.status.connected) {
      console.log('Already connected.');
      return Promise.resolve(this.port_);
    }
    console.info('Trying to connect to the app...');
    this.port_ = chrome.runtime.connect(this.appId_, this.options_);
    if (!this.port_) {
      return Promise.reject(new Error('Unable to connect to App.'));
    }
    return new Promise<chrome.runtime.Port>((F, R) => {
      // Wait for message from the other side to ACK our connection to Freedom
      // (there is no callback for a runtime connection [25 Aug 2013])
      var ackConnection = (msg :string) => {
        if (ChromeGlue.HELLO !== msg) {
          R(new Error('Unexpected msg from uProxy Chrome App: ' + msg));
        }
        console.log('Got hello from uProxy Chrome App:', msg);
        // Replace message listener for the updating mechanism.
        this.port_.onMessage.removeListener(ackConnection);
        this.port_.onMessage.addListener(this.dispatchFreedomEvent_);
        this.status.connected = true;
        F(this.port_);
      };
      // Prepare the disconnection promise.
      this.port_.onDisconnect.addListener(this.currentDisconnectCallback_);
      this.port_.onMessage.addListener(ackConnection);
      // Send 'hi', which should prompt App to respond with ack.
      this.port_.postMessage('hi');
    }).catch((e) => {
      this.status.connected = false;
      this.port_ = null;
      return Promise.reject(new Error('Unable to connect to uProxy Chrome App.'));
    });
    // this.currentDisconnectCallback_ = this.onDisconnectedInternal_.bind(this);
    // this.port_.onDisconnect.addListener(this.currentDisconnectCallback_);
    // this.currentMessageCallback_ = this.onFirstMessage_;
    // this.port_.onMessage.addListener(this.currentMessageCallback_);
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
      this.port_.postMessage({
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
      this.port_.postMessage({
        cmd: 'on',
        type: type
      });
    } catch (e) {
      console.warn('on: postMessage Failed. Disconnecting.');
      this.onDisconnectedInternal_();
    }
  }

  // CoreAPI interface requirements:

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
    if (this.port_) {
      if (this.currentMessageCallback_) {
        this.port_.onMessage.removeListener(this.currentMessageCallback_);
        this.currentMessageCallback_ = null;
      }

      if (this.currentDisconnectCallback_) {
        this.port_.onDisconnect.removeListener(this.currentDisconnectCallback_);
        this.currentDisconnectCallback_ = null;
      }

      this.port_.disconnect();
      this.onDisconnected.dispatch();
      this.port_ = null;
    }

    this.listeners_ = {};
  }

  /**
   * Continuously check if we need to connect to the App.
   */
  private checkAppConnection_ = () => {
    console.log('Checking the app connection.');
    this.connect();  // Doesn't do anything if it's already connected.
    setTimeout(this.checkAppConnection_, SYNC_TIMEOUT);
  }

}  // class ChromeAppConnector
