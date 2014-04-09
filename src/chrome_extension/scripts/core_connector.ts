/**
 * core_connector.ts
 *
 * Handles all connection and communication with the uProxy Chrome App.
 */
/// <reference path='../../../third_party/DefinitelyTyped/chrome/chrome.d.ts'/>
/// <reference path='../../../node_modules/freedom-typescript-api/interfaces/promise.d.ts' />
/// <reference path="../../interfaces/uproxy.d.ts"/>
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

  private appId_   :string;                // ID of target Chrome App.
  private appPort_ :chrome.runtime.Port;   // For speaking to App.
  private queue_   :ChromeGlue.Payload[];  // Queue for outgoing appPort_ msgs.

  // Status object indicating whether we're connected to the app.
  // TODO: Since this is equivalent to whether or not appPort_ is null, we
  // should probably consider turning it into a function, while at the same time
  // preserving potential angular bindings.
  public status :StatusObject;

  // A freedom-type indexed object where each key provides a list of listener
  // callbacks: e.g. { type1 :[listener1_for_type1, ...], ... }
  // TODO: Replace with Core -> UI specified update API.
  private listeners_ :{[type :string] : Function[]};

  private disconnectPromise_ :Promise<void>;
  private fulfillDisconnect_ :Function;

  /**
   * As soon as one constructs the CoreConnector, it will attempt to connect.
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
  public connect = () : Promise<chrome.runtime.Port> => {
    var connectPromise = this.connect_().then(this.flushQueue);
    connectPromise.then(() => {
      this.sendCommand(uProxy.Command.READY);
    });
    // Separate the promise chain which deals with polling, since the user
    // only cares about the initial success.
    connectPromise
        .then(this.prepareForFutureDisconnect_)
        .then(() => {
          // If disconnected, return to polling for connections.
          // This is longform so jasmine's spies can see it.
          this.onceDisconnected().then(() => {
            this.connect();
          });
        })
        .catch((e) => {
          // If connection failed, keep polling.
          console.warn(e);
          console.warn('Retrying in ' + (SYNC_TIMEOUT/1000) + 's...');
          setTimeout(this.connect, SYNC_TIMEOUT);
        })
    return connectPromise;
  }

  /**
   * Returns a promise fulfilled by this connector's disconnection.
   */
  public onceDisconnected = () : Promise<void> => {
    return this.disconnectPromise_;
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
      this.appPort_ = null;
      return Promise.reject(new Error('Unable to connect to App.'));
    }
    return new Promise<chrome.runtime.Port>((F, R) => {
      // Wait for message from the other side to ACK our connection to Freedom
      // (there is no callback for a runtime connection [25 Aug 2013])
      var ackResponse :Function = (msg :string) => {
        if (ChromeGlue.ACK !== msg) {
          R(new Error('Unexpected msg from uProxy App: ' + msg));
        }
        // Replace message listener for the updating mechanism.
        // TODO: Merge the ack-response into the same format as the other
        // payloads so that we don't need to swap out the handler.
        console.log(this.appPort_);
        this.appPort_.onMessage.removeListener(ackResponse);
        this.appPort_.onMessage.addListener(this.receive_);
        this.status.connected = true;
        F(this.appPort_);
        console.log('Connected to app.');
      };
      this.appPort_.onMessage.addListener(ackResponse);
      // Send 'hi', which should prompt App to respond with ack.
      this.appPort_.postMessage(ChromeGlue.CONNECT);

    }).catch((e) => {
      console.log(e);
      this.status.connected = false;
      this.appPort_ = null;
      return Promise.reject(new Error('Unable to connect to uProxy App.'));
    });
  }

  /**
   * Helper which prepares a fresh disconnection promise. Should be called after
   * setting up a successful connection to the App for the first time.
   */
  private prepareForFutureDisconnect_ = () => {
    // If connected, stop polling until the next disconnect.
    // Prepare the disconnection promise.
    var fulfillDisconnect :Function;
    this.disconnectPromise_ = new Promise<void>((F, R) => {
      fulfillDisconnect = F;
    }).then(() => {
      console.log('Extension got disconnected from app.');
      this.status.connected = false;
      if (this.appPort_) {
        this.appPort_.onDisconnect.removeListener(fulfillDisconnect);
        this.appPort_.disconnect();
        this.appPort_ = null;
      }
    });
    this.appPort_.onDisconnect.addListener(fulfillDisconnect);
  }

  // --- Communication ---
  // TODO: Replace this with an actual Core->UI update mechanism, which means
  // we'll use Enums instead of strings.

  /**
   * Attach handlers for updates emitted from the uProxy Core.
   *
   * These handlers persist through disconnections and reconnections, and may be
   * installed whether or not the Extension is currently connected to the App.
   */
  public onUpdate = (update :uProxy.Update, handler :Function) => {
    var type = '' + update;
    if (!(type in this.listeners_)) {
      this.listeners_[type] = [];
    }
    this.listeners_[type].push(handler);
    var payload = {
      cmd: 'on',
      type: update
    };
    console.log('UI onUpdate for', JSON.stringify(payload));
    this.send_(payload);
  }

  /**
   * Send a Command from the UI to the Core, as a result of some user
   * interaction.
   */
  public sendCommand = (command :uProxy.Command, data ?:any) => {
    var payload = {
      cmd: 'emit',
      type: command,
      data: data
    }
    console.log('UI sending Command: ', JSON.stringify(payload));
    this.send_(payload);
  }

  /**
   * Send a payload to the Chrome app.
   * If currently connected to the App, immediately send. Otherwise, queue
   * the message for the next successful connection.
   */
  private send_ = (payload :ChromeGlue.Payload) => {
    if (!this.status.connected || null == this.appPort_) {
      this.queue_.push(payload);
      return;
    }
    try {
      this.appPort_.postMessage(payload);
    } catch (e) {
      console.warn(e);
      console.warn('ChromeCoreConnector.send_ postMessage failure.');
    }
  }

  /**
   * Receive messages from the chrome.runtime.Port.
   * These *must* some form of uProxy.Update.
   */
  private receive_ = (msg :{type :string; data :any}) => {
    if (msg.type in this.listeners_) {
      var handlers :Function[] = this.listeners_[msg.type].slice(0);
      handlers.forEach((handler) => { handler(msg.data); });
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
      this.send_(payload);
    }
    return port;
  }


  // --- CoreAPI interface requirements (sending COMMANDS) ---

  reset = () => {
    console.log('Resetting.');
    this.sendCommand(uProxy.Command.RESET, null);
  }

  sendInstance = (clientId) => {
    this.sendCommand(uProxy.Command.SEND_INSTANCE, clientId);
  }

  modifyConsent = (instanceId, action) => {
    console.log('Modifying consent.', instanceId);
    this.sendCommand(uProxy.Command.MODIFY_CONSENT,
      {
        instanceId: instanceId,
        action: action
      }
    );
  }

  start = (instanceId) => {
    console.log('Starting to proxy through ' + instanceId);
    this.sendCommand(uProxy.Command.START_PROXYING, instanceId);
  }

  stop = (instanceId) => {
    console.log('Stopping proxy through ' + instanceId);
    this.sendCommand(uProxy.Command.STOP_PROXYING, instanceId);
  }

  updateDescription = (description) => {
    console.log('Updating description to ' + description);
    this.sendCommand(uProxy.Command.UPDATE_DESCRIPTION, description);
  }

  changeOption = (option) => {
    console.log('Changing option ' + option);
    // this.sendCommand(uProxy.Command.CHANGE_OPTION, option);
  }

  login = (network) => {
    this.sendCommand(uProxy.Command.LOGIN, network);
  }

  logout = (network) => {
    this.sendCommand(uProxy.Command.LOGOUT, network);
  }

  dismissNotification = (userId) => {
    this.sendCommand(uProxy.Command.DISMISS_NOTIFICATION, userId);
  }

}  // class ChromeCoreConnector
