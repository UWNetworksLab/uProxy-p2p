/**
 * core_connector.ts
 *
 * Handles all connection and communication with the uProxy Chrome App.
 */
/// <reference path='../../uproxy.ts'/>
/// <reference path='../../../node_modules/freedom-typescript-api/interfaces/promise.d.ts' />

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

  constructor(private connector_ :uProxy.CoreConnector) {
    this.connector_.onUpdate(uProxy.Update.COMMAND_FULFILLED,
                             this.handleRequestFulfilled_);
    this.connector_.onUpdate(uProxy.Update.COMMAND_REJECTED,
                             this.handleRequestRejected_);
  }

  public connected = () => {
    return this.connector_.status.connected;
  }

  public onUpdate = (update :uProxy.Update, handler :Function) => {
    this.connector_.onUpdate(update, handler);
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
    this.connector_.send(payload);
  }

  /**
   * Send a Command from the UI to the Core, as a result of some user
   * interaction.  Command returns a promise that fulfills/rejects upon
   * an ack/reject from the backend.
   */
  public promiseCommand = (command :uProxy.Command, data ?:any)
      : Promise<void> => {
    var promiseId :number = ++(this.promiseId_);
    var payload :uProxy.Payload = {
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

    // Send request to backend.
    this.connector_.send(payload);

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
}  // class CoreConnector
