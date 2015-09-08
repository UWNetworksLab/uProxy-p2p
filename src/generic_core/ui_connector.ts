/// <reference path='../../../third_party/typings/freedom/freedom-module-env.d.ts' />

import uproxy_core_api = require('../interfaces/uproxy_core_api');
import browser_connector = require('../interfaces/browser_connector');
import logging = require('../../../third_party/uproxy-lib/logging/logging');
import globals = require('./globals');
import social = require('../interfaces/social');
import social_network = require('./social');

var log :logging.Log = new logging.Log('ui_connector');

// This is the channel to speak to the UI component of uProxy.
// The UI is running from the privileged part of freedom, so we can just set
// this to be freedom, and communicate using 'emit's and 'on's.
var bgAppPageChannel = freedom();

// Entry-point into the UI.
export class UIConnector {
  constructor() {}

  /**
   * Install a handler for commands received from the UI.
   */
  public onCommand = (cmd :uproxy_core_api.Command, handler:any) => {
    bgAppPageChannel.on('' + cmd,
      (args :browser_connector.PromiseCommand) => {
        // Call handler with args.data and ignore other fields in args
        // like promiseId.
        handler(args.data);
      });
  }

  /**
   * Install a handler for promise commands received from the UI.
   * Promise commands return an ack or error to the UI.
   */
  public onPromiseCommand = (cmd :uproxy_core_api.Command,
                             handler :(data ?:any) => Promise<any>) => {
    var promiseCommandHandler = (args :browser_connector.PromiseCommand) => {
      // Ensure promiseId is set for all requests
      if (!args.promiseId) {
        var err = 'onPromiseCommand called for cmd ' + cmd +
                  'with promiseId undefined';
        log.error(err);
        return Promise.reject(new Error(err));
      }

      // Call handler function, then return success or failure to UI.
      handler(args.data).then(
        (argsForCallback ?:any) => {
          this.update(uproxy_core_api.Update.COMMAND_FULFILLED,
              { command: cmd,
                promiseId: args.promiseId,
                argsForCallback: argsForCallback });
        },
        (errorForCallback :Error) => {
          var rejectionData = {
            promiseId: args.promiseId,
            errorForCallback: errorForCallback.toString()
          };
          this.update(uproxy_core_api.Update.COMMAND_REJECTED, rejectionData);
        }
      );
    };
    bgAppPageChannel.on('' + cmd, promiseCommandHandler);
  }

  /**
   * Send an Update message to the UI.
   * TODO: Turn this private and make outside accesses directly based on UiApi.
   */
  public update = (type:uproxy_core_api.Update, data?:any) => {
    var printableType :string = uproxy_core_api.Update[type];
    if (type == uproxy_core_api.Update.COMMAND_FULFILLED
        && data['command'] == uproxy_core_api.Command.GET_LOGS){
      log.debug('sending logs to UI', {
        type: printableType,
        data: 'logs not printed to prevent duplication if logs are sent again.'
      });
    } else {
      log.debug('sending message to UI', {
        type: printableType,
        data: data
      });
    }
    bgAppPageChannel.emit('' + type, data);
  }

  public syncUser = (payload:social.UserData) => {
    this.update(uproxy_core_api.Update.USER_FRIEND, payload);
  }
}

// Now that this module has got itself setup, it sends a 'ready' message to the
// freedom background page.
bgAppPageChannel.emit('ready', null);

export var connector = new UIConnector();
