/**
 * core_connector.ts
 *
 * Handles all connection and communication with the uProxy core.
 */
/// <reference path='../../../../third_party/typings/es6-promise/es6-promise.d.ts' />

import uproxy_core_api = require('../../interfaces/uproxy_core_api');
import browser_connector = require('../../interfaces/browser_connector');
import social = require('../../interfaces/social');
import net = require('../../../../third_party/uproxy-lib/net/net.types');

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
class CoreConnector implements uproxy_core_api.CoreApi {

  // Global unique promise ID.
  private promiseId_ :number = 1;
  private mapPromiseIdToFulfillAndReject_ :{[id :number] : FullfillAndReject} =
      {};

  // If non-null, the ID of the instance from which we are presently
  // disconnected.
  public disconnectedWhileProxying :string = null;

  constructor(private browserConnector_ :browser_connector.CoreBrowserConnector) {
    this.browserConnector_.onUpdate(uproxy_core_api.Update.COMMAND_FULFILLED,
                                    this.handleRequestFulfilled_);
    this.browserConnector_.onUpdate(uproxy_core_api.Update.COMMAND_REJECTED,
                                    this.handleRequestRejected_);

    this.connect();
  }

  public on = (name :string, callback :Function) => {
    this.browserConnector_.on(name, callback);
  }

  public connect = () :Promise<void> => {
    return this.browserConnector_.connect();
  }

  public connected = () => {
    return this.browserConnector_.status.connected;
  }

  public onUpdate = (update :uproxy_core_api.Update, handler :Function) => {
    this.browserConnector_.onUpdate(update, handler);
  }

  /**
   * Send a Command from the UI to the Core, as a result of some user
   * interaction.
   */
  public sendCommand = (command :uproxy_core_api.Command, data ?:any) => {
    var payload :browser_connector.Payload = {
      cmd: 'emit',
      type: command,
      data: data,
      promiseId: 0
    }
    console.log('UI sending Command ' + //uproxy_core_api.Command[command],
        JSON.stringify(payload));
    this.browserConnector_.send(payload);
  }

  /**
   * Send a Command from the UI to the Core, as a result of some user
   * interaction.  Command returns a promise that fulfills/rejects upon
   * an ack/reject from the backend.
   */
  public promiseCommand = (command :uproxy_core_api.Command, data ?:any)
      : Promise<any> => {
    var promiseId :number = ++(this.promiseId_);
    var payload :browser_connector.Payload = {
      cmd: 'emit',
      type: command,
      data: data,
      promiseId: promiseId
    }
    console.log('UI sending Promise Command ' + uproxy_core_api.Command[command],
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

  // --- CoreApi interface requirements (sending COMMANDS) ---

  public getFullState = () :Promise<uproxy_core_api.InitialState> => {
    return this.promiseCommand(uproxy_core_api.Command.GET_FULL_STATE);
  }

  // TODO: Reconnect this hook, which while we're testing, sends a new instance
  // message anytime we click on the user in the UI.
  sendInstance = (clientId :string) => {
    this.sendCommand(uproxy_core_api.Command.SEND_INSTANCE_HANDSHAKE_MESSAGE, clientId);
  }

  modifyConsent = (command:uproxy_core_api.ConsentCommand) => {
    console.log('Modifying consent.', command);
    this.sendCommand(uproxy_core_api.Command.MODIFY_CONSENT, command);
  }

  startCopyPasteGet = () : Promise<net.Endpoint> => {
    console.log('Starting to proxy for CopyPaste');
    return this.promiseCommand(uproxy_core_api.Command.START_PROXYING_COPYPASTE_GET);
  }

  stopCopyPasteGet = () :Promise<void> => {
    return this.promiseCommand(uproxy_core_api.Command.STOP_PROXYING_COPYPASTE_GET);
  }

  startCopyPasteShare = ()  => {
    this.sendCommand(uproxy_core_api.Command.START_PROXYING_COPYPASTE_SHARE);
  }

  stopCopyPasteShare = () :Promise<void> => {
    return this.promiseCommand(uproxy_core_api.Command.STOP_PROXYING_COPYPASTE_SHARE);
  }

  sendCopyPasteSignal = (signal:string) => {
    this.sendCommand(uproxy_core_api.Command.COPYPASTE_SIGNALLING_MESSAGE, signal);
  }

  start = (path :social.InstancePath) : Promise<net.Endpoint> => {
    console.log('Starting to proxy through ' + path);
    return this.promiseCommand(uproxy_core_api.Command.START_PROXYING, path);
  }

  stop = (path :social.InstancePath) => {
    console.log('Stopping proxy session.');
    this.sendCommand(uproxy_core_api.Command.STOP_PROXYING, path);
  }

  updateGlobalSettings = (newSettings :uproxy_core_api.GlobalSettings) => {
    console.log('Updating global settings to ' + JSON.stringify(newSettings));
    this.sendCommand(uproxy_core_api.Command.UPDATE_GLOBAL_SETTINGS,
                     newSettings);
  }

  // TODO: Implement this or remove it.
  // changeOption = (option) => {
  //   console.log('Changing option ' + option);
  //   this.sendCommand(uproxy_core_api.Command.CHANGE_OPTION, option);
  // }

  login = (loginArgs :uproxy_core_api.LoginArgs) : Promise<void> => {
    return this.promiseCommand(uproxy_core_api.Command.LOGIN, loginArgs);
  }

  logout = (networkInfo :social.SocialNetworkInfo) : Promise<void> => {
    return this.promiseCommand(uproxy_core_api.Command.LOGOUT, networkInfo);
  }

  addUser = (inviteUrl: string): Promise<void> => {
    return this.promiseCommand(uproxy_core_api.Command.ADD_USER, inviteUrl);
  }

  // TODO: this should probably take the network path, including userId
  getInviteUrl = (networkInfo :social.SocialNetworkInfo): Promise<string> => {
    return this.promiseCommand(uproxy_core_api.Command.GET_INVITE_URL,
        networkInfo);
  }

  // TODO: this should probably take the network path, including userId
  sendEmail = (emailData :uproxy_core_api.EmailData): void => {
    this.sendCommand(uproxy_core_api.Command.SEND_EMAIL, emailData);
  }

  restart = () => {
    this.browserConnector_.restart();
  }

  getLogs = () : Promise<string> => {
    return this.promiseCommand(uproxy_core_api.Command.GET_LOGS);
  }

  getNatType = () : Promise<string> => {
    return this.promiseCommand(uproxy_core_api.Command.GET_NAT_TYPE);
  }

  refreshPortControlSupport = () : Promise<void> => {
    return this.promiseCommand(uproxy_core_api.Command.REFRESH_PORT_CONTROL);
  }

  pingUntilOnline = (pingUrl :string) : Promise<void> => {
    return this.promiseCommand(
        uproxy_core_api.Command.PING_UNTIL_ONLINE, pingUrl);
  }

  getVersion = () :Promise<{ version :string }> => {
    return this.promiseCommand(uproxy_core_api.Command.GET_VERSION);
  }
}  // class CoreConnector

export = CoreConnector;
