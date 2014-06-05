/**
 * core_connector.ts
 *
 * Handles all connection and communication with the uProxy Chrome App.
 */
/// <reference path='background.ts'/>
/// <reference path='../../../uproxy.ts'/>
/// <reference path='../../util/chrome_glue.ts' />

/// <reference path='../../../../node_modules/freedom-typescript-api/interfaces/promise.d.ts' />

var UPROXY_CHROME_APP_ID :string = 'fmdppkkepalnkeommjadgbhiohihdhii';
var SYNC_TIMEOUT         :number = 1000;  // milliseconds.

interface FullfillAndReject {
  fulfill :Function;
  reject :Function;
};

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

  // Global unique promise ID.
  private promiseId_ :number = 1;
  private mapPromiseIdToFulfillAndReject_ :{[id :number] : FullfillAndReject} =
      {};

  /**
   * As soon as one constructs the CoreConnector, it will attempt to connect.
   */
  constructor(private options_ ?:chrome.runtime.ConnectInfo) {
    this.appId_ = UPROXY_CHROME_APP_ID;
    this.status = { connected: false };
    this.appPort_ = null;
    this.queue_ = [];
    this.listeners_ = {};

    this.onUpdate(uProxy.Update.COMMAND_FULFILLED,
                  this.handleRequestFulfilled_);
    this.onUpdate(uProxy.Update.COMMAND_REJECTED,
                  this.handleRequestRejected_);
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
      return Promise.resolve();
    }

    return this.connect_().then(this.flushQueue).then(() => {
      // Connect/reconnect listeners to app.  These will not have been queued,
      // in order to prevent duplicate requests, and will need to be re-sent
      // after each successful reconnection to the app.
      for (var type in this.listeners_) {
        // Convert type from string back to number (uProxy.Update enum) for
        // payload to app.
        var payload = {
          cmd: 'on',
          type: parseInt(type, 10)
        };
        console.log('Connecting listener for', JSON.stringify(payload));
        this.send_(payload);
      }

      this.sendCommand(uProxy.Command.READY);
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
      var ackResponse :Function = (msg :string) => {
        console.log('connect_: in ackResponse');
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
      };
      this.appPort_.onMessage.addListener(ackResponse);
      // Send 'hi', which should prompt App to respond with ack.
      this.appPort_.postMessage(ChromeGlue.CONNECT);
    }).catch((e) => {
      console.log(e);
      // Manually invoke disconnect handler which will retry connection.
      this.onDisconnectHandler_();
      return Promise.reject(new Error('Unable to connect to uProxy App.'));
    });
  }

  private onDisconnectHandler_ = () => {
    // Note this is invoked both when a connection to the app was established
    // and then disconnected, and when a connection to the app could not
    // be establish (i.e. this.appPort_.postMessage in connect_ failed).
    console.log('Disconnected from app, previous status was ' +
                this.status.connected);

    // Update this.status and this.appPort_ to ensure we are disconnected.
    this.status.connected = false;
    this.appPort_ = null;

    console.warn('Retrying connection in ' + (SYNC_TIMEOUT/1000) + 's...');
    setTimeout(this.connect, SYNC_TIMEOUT);
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
    this.send_(payload, true);
  }

  /**
   * Send a Command from the UI to the Core, as a result of some user
   * interaction.
   */
  public sendCommand = (command :uProxy.Command, data ?:any) => {
    var payload :ChromeGlue.Payload = {
      cmd: 'emit',
      type: command,
      data: data,
      promiseId: 0
    }
    console.log('UI sending Command ' + //uProxy.Command[command],
        JSON.stringify(payload));
    this.send_(payload);
  }

  /**
   * Send a Command from the UI to the Core, as a result of some user
   * interaction.  Command returns a promise that fulfills/rejects upon
   * an ack/reject from the app.
   */
  public promiseCommand = (command :uProxy.Command, data ?:any)
      : Promise<void> => {
    var promiseId :number = ++(this.promiseId_);
    var payload :ChromeGlue.Payload = {
      cmd: 'emit',
      type: command,
      data: data,
      promiseId: promiseId
    }
    console.log('UI sending Promise Command ' + //uProxy.Command[command],
        JSON.stringify(payload));

    // Create a new promise and store its fulfill and reject functions.
    var fulfillFunc :Function;
    var rejectFunc :Function;
    var promise :Promise<void> = new Promise<void>((F, R) => {
      fulfillFunc = F;
      rejectFunc = R;
    });
    // TODO: we may want to periodically remove garbage from this table
    // e.g. if the app restarts, all promises should be removed or reject.
    // Also we may want to reject promises after some timeout.
    this.mapPromiseIdToFulfillAndReject_[promiseId] = {
      fulfill: fulfillFunc,
      reject: rejectFunc
    };

    // Send request to app.
    this.send_(payload);

    return promise;
  }

  private handleRequestFulfilled_ = (promiseId :number) => {
    console.log('promise command fulfilled ' + promiseId);
    if (this.mapPromiseIdToFulfillAndReject_[promiseId]) {
      this.mapPromiseIdToFulfillAndReject_[promiseId].fulfill();
      delete this.mapPromiseIdToFulfillAndReject_[promiseId];
    } else {
      console.warn('fulfill not found ' + promiseId);
    }
  }

  private handleRequestRejected_ = (promiseId :number) => {
    console.log('promise command rejected ' + promiseId);
    if (this.mapPromiseIdToFulfillAndReject_[promiseId]) {
      this.mapPromiseIdToFulfillAndReject_[promiseId].reject();
      delete this.mapPromiseIdToFulfillAndReject_[promiseId];
    } else {
      console.warn('reject not found ' + promiseId);
    }
  }

  /**
   * Send a payload to the Chrome app.
   * If currently connected to the App, immediately send. Otherwise, queue
   * the message for the next successful connection.
   * If skipQueue==true, payloads will not be enqueued when app is disconnected.
   */
  private send_ = (payload :ChromeGlue.Payload,
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
      this.send_(payload);
    }
    return port;
  }


  // --- CoreAPI interface requirements (sending COMMANDS) ---

  reset = () => {
    console.log('Resetting.');
    this.sendCommand(uProxy.Command.RESET, null);
  }

  // TODO: Reconnect this hook, which while we're testing, sends a new instance
  // message anytime we click on the user in the UI.
  sendInstance = (clientId) => {
    this.sendCommand(uProxy.Command.SEND_INSTANCE, clientId);
  }

  modifyConsent = (command:uProxy.ConsentCommand) => {
    console.log('Modifying consent.', command);
    this.sendCommand(uProxy.Command.MODIFY_CONSENT, command);
  }

  start = (path :InstancePath) : Promise<void> => {
    console.log('Starting to proxy through ' + path);
    return this.promiseCommand(uProxy.Command.START_PROXYING, path).then(() => {
      proxyConfig.startUsingProxy();
    });
  }

  stop = () => {
    console.log('Stopping proxy session.');
    this.sendCommand(uProxy.Command.STOP_PROXYING);
    proxyConfig.stopUsingProxy();
  }

  updateDescription = (description :string) => {
    // TODO: determine if novelty check is necessary.
    console.log('Updating description to ' + description);
    this.sendCommand(uProxy.Command.UPDATE_DESCRIPTION, description);
  }

  changeOption = (option) => {
    console.log('Changing option ' + option);
    // this.sendCommand(uProxy.Command.CHANGE_OPTION, option);
  }

  login = (network :string) : Promise<void> => {
    return this.promiseCommand(uProxy.Command.LOGIN, network);
  }

  logout = (network :string) => {
    this.sendCommand(uProxy.Command.LOGOUT, network);
  }

  dismissNotification = (userId) => {
    this.sendCommand(uProxy.Command.DISMISS_NOTIFICATION, userId);
  }
}  // class ChromeCoreConnector
