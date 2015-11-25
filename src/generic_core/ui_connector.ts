/// <reference path='../../../third_party/typings/freedom/freedom-module-env.d.ts' />

import browser_connector = require('../interfaces/browser_connector');
import globals = require('./globals');
import logging = require('../../../third_party/uproxy-lib/logging/logging');
import social_network = require('./social');
import social = require('../interfaces/social');
import uproxy_core_api = require('../interfaces/uproxy_core_api');

var log :logging.Log = new logging.Log('ui_connector');

// This is the channel to speak to the UI component of uProxy.
// The UI is running from the privileged part of freedom, so we can just set
// this to be freedom, and communicate using 'emit's and 'on's.
var bgAppPageChannel = freedom();

// Entry-point into the UI.
export class UIConnector {
  constructor() {}

  private fulfillPromise_(promiseId :number,
                          command :uproxy_core_api.Command,
                          args?:any) {
    this.update(uproxy_core_api.Update.COMMAND_FULFILLED, {
      command: command,
      promiseId: promiseId,
      argsForCallback: args,
    });
  }

  private rejectPromise_(promiseId :number, reason :Error) {
    this.update(uproxy_core_api.Update.COMMAND_REJECTED, {
      promiseId: promiseId,
      errorForCallback: reason.toString(),
    });
  }

  public onCommand(cmd :uproxy_core_api.Command,
                   handler :(data ?:any) => (Promise<any>|void)) {
    // this function returns a promise solely for use in tests, it will normally
    // not affect anything
    var commandHandler = (args :browser_connector.PromiseCommand) => {
      try {
        var result = handler(args.data);
      } catch (e) {
        result = Promise.reject(e);
      }

      if (!args.promiseId) {
        if (result) {
          console.warn('Unexpected return value from command ' + cmd + ' with ' +
                       'no way to send result');
        }
        return Promise.resolve<void>();
      }

      if (!result) {
        this.fulfillPromise_(args.promiseId, cmd, null);
        log.warn('Handler for command ' + cmd + ' did not return the expected ' +
                 'value');
        return Promise.resolve<void>();
      }

      if (!(<Promise<any>>result).then) {
        log.warn('Handler for command ' + cmd + ' returned a value instead of ' +
                 'a promise');
        this.fulfillPromise_(args.promiseId, cmd, result);
        return Promise.resolve<void>();
      }

      return (<Promise<any>>result).then((result?:any) => {
        this.fulfillPromise_(args.promiseId, cmd, result);
      }, (error :Error) => {
        this.rejectPromise_(args.promiseId, error);
      });
    }

    bgAppPageChannel.on('' + cmd, commandHandler);
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
