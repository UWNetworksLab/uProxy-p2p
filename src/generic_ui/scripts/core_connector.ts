/**
 * core_connector.ts
 *
 * Handles all connection and communication with the uProxy core.
 */
/// <reference path='../../uproxy.ts'/>
/// <reference path='../../interfaces/persistent.d.ts' />
/// <reference path='../../third_party/typings/es6-promise/es6-promise.d.ts' />

interface FullfillAndReject {
  fulfill :Function;
  reject :Function;
};

/**
 * This class hides all cross backend-ui communication wiring so that the
 * uProxy UI may speak through this connector as if talking directly to Core.
 *
 * Propagates these messages:
 *    Core --[ UPDATES  ]--> UI
 *    UI   --[ COMMANDS ]--> Core
 */
class CoreConnector implements uProxy.CoreAPI {

  // Global unique promise ID.
  private promiseId_ :number = 1;
  private mapPromiseIdToFulfillAndReject_ :{[id :number] : FullfillAndReject} =
      {};

  constructor(private browserConnector_ :uProxy.CoreBrowserConnector) {
    this.browserConnector_.onUpdate(uProxy.Update.COMMAND_FULFILLED,
                                    this.handleRequestFulfilled_);
    this.browserConnector_.onUpdate(uProxy.Update.COMMAND_REJECTED,
                                    this.handleRequestRejected_);
  }

  public connected = () => {
    return this.browserConnector_.status.connected;
  }

  public onUpdate = (update :uProxy.Update, handler :Function) => {
    this.browserConnector_.onUpdate(update, handler);
  }

  /**
   * Send a Command from the UI to the Core, as a result of some user
   * interaction.
   */
  public sendCommand = (command :uProxy.Command, data ?:any) => {
    var payload :uProxy.Payload = {
      cmd: 'emit',
      type: command,
      data: data,
      promiseId: 0
    }
    console.log('UI sending Command ' + //uProxy.Command[command],
        JSON.stringify(payload));
    this.browserConnector_.send(payload);
  }

  /**
   * Send a Command from the UI to the Core, as a result of some user
   * interaction.  Command returns a promise that fulfills/rejects upon
   * an ack/reject from the backend.
   */
  public promiseCommand = (command :uProxy.Command, data ?:any)
      : Promise<any> => {
    var promiseId :number = ++(this.promiseId_);
    var payload :uProxy.Payload = {
      cmd: 'emit',
      type: command,
      data: data,
      promiseId: promiseId
    }
    console.log('UI sending Promise Command ' + uProxy.Command[command],
        JSON.stringify(payload));

    // Create a new promise and store its fulfill and reject functions.
    var fulfillFunc :Function;
    var rejectFunc :Function;
    var promise :Promise<any> = new Promise<any>((F, R) => {
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

    // Send request to backend.
    this.browserConnector_.send(payload);

    return promise;
  }

  private handleRequestFulfilled_ = (data :any) => {
    var promiseId = data.promiseId;
    console.log('promise command fulfilled ' + promiseId);
    if (this.mapPromiseIdToFulfillAndReject_[promiseId]) {
      this.mapPromiseIdToFulfillAndReject_[promiseId]
          .fulfill(data.argsForCallback);
      delete this.mapPromiseIdToFulfillAndReject_[promiseId];
    } else {
      console.warn('fulfill not found ' + promiseId);
    }
  }

  private handleRequestRejected_ = (data :any) => {
    var promiseId = data.promiseId;
    console.log('promise command rejected ' + promiseId);
    if (this.mapPromiseIdToFulfillAndReject_[promiseId]) {
      this.mapPromiseIdToFulfillAndReject_[promiseId]
          .reject(data.errorForCallback);
      delete this.mapPromiseIdToFulfillAndReject_[promiseId];
    } else {
      console.warn('reject not found ' + promiseId);
    }
  }

  // --- CoreAPI interface requirements (sending COMMANDS) ---

  // TODO: Reconnect this hook, which while we're testing, sends a new instance
  // message anytime we click on the user in the UI.
  sendInstance = (clientId) => {
    this.sendCommand(uProxy.Command.SEND_INSTANCE_HANDSHAKE_MESSAGE, clientId);
  }

  modifyConsent = (command:uProxy.ConsentCommand) => {
    console.log('Modifying consent.', command);
    this.sendCommand(uProxy.Command.MODIFY_CONSENT, command);
  }

  startCopyPasteGet = () : Promise<Net.Endpoint> => {
    console.log('Starting to proxy for CopyPaste');
    return this.promiseCommand(uProxy.Command.START_PROXYING_COPYPASTE_GET);
  }

  stopCopyPasteGet = () :Promise<void> => {
    return this.promiseCommand(uProxy.Command.STOP_PROXYING_COPYPASTE_GET);
  }

  startCopyPasteShare = ()  => {
    this.sendCommand(uProxy.Command.START_PROXYING_COPYPASTE_SHARE);
  }

  stopCopyPasteShare = () :Promise<void> => {
    return this.promiseCommand(uProxy.Command.STOP_PROXYING_COPYPASTE_SHARE);
  }

  sendCopyPasteSignal = (signal :uProxy.Message) => {
    this.sendCommand(uProxy.Command.COPYPASTE_SIGNALLING_MESSAGE, signal);
  }

  start = (path :InstancePath) : Promise<Net.Endpoint> => {
    console.log('Starting to proxy through ' + path);
    return this.promiseCommand(uProxy.Command.START_PROXYING, path);
  }

  stop = () => {
    console.log('Stopping proxy session.');
    this.sendCommand(uProxy.Command.STOP_PROXYING);
  }

  updateGlobalSettings = (newSettings :Core.GlobalSettings) => {
    console.log('Updating global settings to ' + JSON.stringify(newSettings));
    this.sendCommand(uProxy.Command.UPDATE_GLOBAL_SETTINGS,
                     newSettings);
  }

  // TODO: Implement this or remove it.
  // changeOption = (option) => {
  //   console.log('Changing option ' + option);
  //   this.sendCommand(uProxy.Command.CHANGE_OPTION, option);
  // }

  login = (network :string) : Promise<void> => {
    return this.promiseCommand(uProxy.Command.LOGIN, network);
  }

  logout = (networkInfo :NetworkInfo) : Promise<void> => {
    return this.promiseCommand(uProxy.Command.LOGOUT, networkInfo);
  }

  restart = () => {
    this.browserConnector_.restart();
  }

  getLogs = () : Promise<string> => {
    return this.promiseCommand(uProxy.Command.GET_LOGS);
  }

  getNatType = () : Promise<string> => {
    return this.promiseCommand(uProxy.Command.GET_NAT_TYPE);
  }
}  // class CoreConnector
