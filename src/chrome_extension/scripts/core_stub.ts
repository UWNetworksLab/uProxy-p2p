// Provides 'CoreStub' object that acts like freedomos.org
// freedom object, but posts/listens to messages from freedom via a chrome.
// runtime.message.

// This is a fake freedom module builder that simply passes messages to a
// |id| is the chrome extension/app Id that is running Freedom that we
//   should speak to.
// |options| is the options passed the runtime connection. It has a 'name'
//   field that can be used to name the connection to the freedom component.

/// <reference path="../../../third_party/DefinitelyTyped/chrome/chrome.d.ts"/>

// Status object for connected. This is an object so it can be bound in
// angular. connected = true iff connected to the app which is running
// freedom.
interface StatusObject {
  connected :boolean;
};


class CoreStub {
  // Status object whose connected boolean property indicates if we are
  // connected to the app.
  status :StatusObject;
  // A callback |function() {...}| to call when we are disconnected. e.g. when
  // Freedom extension/app is removed/disabled.
  onDisconnected :chrome.Event;
  // A callback |function() {...}| to call when connected.
  onConnected :chrome.Event;

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

  constructor(id :string, options :Object) {
    this.appId_ = id;
    this.options_ = options;
    this.onDisconnected = new chrome.Event();
    this.onConnected = new chrome.Event();
    this.status = { connected: false };
    this.port_ = null;
    this.listeners_ = {};
    this.currentMessageCallback_ = null;
    this.currentDisconnectCallback_ = null;
  }

  connect() : boolean {
    if(this.status.connected) {
      // console.info('Already connected.');
      return;
    }
    console.info('Trying to connect to the app');
    this.port_ = chrome.runtime.connect(this.appId_, this.options_);

    try {
      this.port_.postMessage("hi");  // message used just to check we can connect.
      this.status.connected = true;
    } catch (e) {
      console.log("Tried to say hi to app, but failed.");
      this.status.connected = false;
      this.port_ = null;
      return false;
    }

    this.currentDisconnectCallback_ = this.onDisconnectedInternal_.bind(this);
    this.port_.onDisconnect.addListener(this.currentDisconnectCallback_);

    this.currentMessageCallback_ = this.onFirstMessage_.bind(this);
    this.port_.onMessage.addListener(this.currentMessageCallback_);
  }

  // Send message to app.
  sendToApp(type :string, data ?:any) {
    if (!this.status.connected) {
      console.error('Cannot call |sendToApp| on a disconnected CoreStub.');
      return;
    }
    try {
      this.port_.postMessage({
        cmd: 'emit',
        type: type,
        data: data
      });
    } catch (e) {
      console.warn("sendToApp: postMessage Failed. Disconnecting.");
      this.onDisconnectedInternal_();
    }
  }

  // Add the listener callback to be called when we get events of type |t|
  // from freedom.
  on(type :string, listener :Function) {
    if (!this.status.connected) {
      console.error('Cannot call |on| on a disconnected CoreStub.');
      return;
    }
    if (this.listeners_[type]) {
      this.listeners_[type].push(listener);
    } else {
      this.listeners_[type] = [listener];
    }
    try {
      this.port_.postMessage({
        cmd: 'on',
        type: type
      });
    } catch (e) {
      console.warn("on: postMessage Failed. Disconnecting.");
      this.onDisconnectedInternal_();
    }
  }

  // This function is used as the callback to listen to messages that should be
  // passed to the freedom listeners in the extension.
  private dispatchFreedomEvent_(msg :{type :string; data :any}) {
    if (this.listeners_[msg.type]) {
      var handlers :Function[] = this.listeners_[msg.type].slice(0);
      for (var i = 0; i < handlers.length; i++) {
        handlers[i](msg.data)
      }
    }
  }

  // This is used to know when we are connected to Freedom (there is no callback
  // possible on the connector side of a runtime connection [25 Aug 2013])
  // When we connect Freedom, we expect Freedom's runtime.Port.onConnect callback
  // to send us the message 'hello.' which means we've connected successfully.
  private onFirstMessage_(msg :string) {
    if ('hello.' == msg) {
      console.info('Got hello from UProxy App.');
      // No longer wait for first message.
      // Relay any messages to this port to any function that has registered as
      // wanting to listen using an 'freedom.on' from this connector.
      this.port_.onMessage.removeListener(this.currentMessageCallback_);
      this.currentMessageCallback_ = this.dispatchFreedomEvent_.bind(this);
      this.port_.onMessage.addListener(this.currentMessageCallback_);
      // If we have an |onConnected| callback, call it.
      this.onConnected.dispatch();
    } else {
      console.warn('Unexpected message from UProxy App: ' + msg);
    }
  }

  // Wrapper for disconnection.
  private onDisconnectedInternal_() {
    console.log('Extension got disconnected from app.');
    this.status.connected = false;
    if(this.port_) {
      if(this.currentMessageCallback_) {
        this.port_.onMessage.removeListener(this.currentMessageCallback_);
        this.currentMessageCallback_ = null;
      }

      if(this.currentDisconnectCallback_) {
        this.port_.onDisconnect.removeListener(this.currentDisconnectCallback_);
        this.currentDisconnectCallback_ = null;
      }

      this.port_.disconnect();
      this.onDisconnected.dispatch();
      //delete this.onDisconnected;
      //delete this.onConnected;
      //this.onDisconnected = new chrome.Event();
      //this.onConnected = new chrome.Event();
      this.port_ = null;
    }

    this.listeners_ = {};
  }
};