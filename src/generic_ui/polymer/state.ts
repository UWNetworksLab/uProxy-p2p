/// <reference path='./context.d.ts' />
/// <reference path='../../../../third_party/typings/browser.d.ts'/>
/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

import panel_connector = require('../../interfaces/panel_connector');
import social = require('../../interfaces/social');
import uproxy_core_api = require('../../interfaces/uproxy_core_api');

//TODO standardize
interface FullfillAndReject {
  fulfill: Function;
  reject: Function;
};

var background: Background = null;
var dialogClickFn: (fulfill: boolean, data?: Object) => void = null;

Polymer({
  ready: function() {
    this.ui = ui_context.ui;
    this.core = ui_context.core;
    this.model = ui_context.model;

    if (background) {
      /*
       * one of these elements should be bound as a message listener, it should
       * not matter which one.  If it turns out it does matter which one, we'll
       * put an attribute for that.
       */
      return;
    }

    background = new Background(this);
  },
  updateGlobalSettings: function(settings: uproxy_core_api.GlobalSettings) {
    return background.updateGlobalSettings(settings);
  },
  restart: function() {
    return background.restart();
  },
  logout: function(networkInfo: social.SocialNetworkInfo): Promise<void> {
    return background.logout(networkInfo);
  },
  handleDialogClick: function(fulfill: boolean, data: Object = null) {
    dialogClickFn(fulfill, data);
    dialogClickFn = null;
  },
  openDialog: function(data: Object) {
    return new Promise<Object>((F, R) => {
      if (dialogClickFn) {
        console.error('Previous dialog was not cleaned up');
        dialogClickFn(false);
      }
      dialogClickFn = (fulfill: boolean, data?: Object) => {
        if (fulfill) {
          F(data);
        } else {
          R(data);
        }
      };

      this.fire('core-signal', {
        name: 'open-dialog',
        data: data
      });
    });
  }
});

class Background {
  private state_: any;
  private connector_: panel_connector.BackgroundUiConnector;
  private promisesMap_: {[id: number]: FullfillAndReject} = {};

  constructor(state: any) {
    if (window.chrome) {
      this.connector_ = new ChromeBackgroundUiConnector(this.handleMessage_);
    } else {
      this.connector_ = new FirefoxBackgroundUiConnector(this.handleMessage_);
    }

    this.state_ = state;
  }

  public updateGlobalSettings = (settings: uproxy_core_api.GlobalSettings): void => {
    this.connector_.sendMessage('update-global-settings', settings);
  }

  public restart = (): void => {
    this.doInBackground_('restart', null);
  }

  public logout = (networkInfo: social.SocialNetworkInfo): Promise<void> => {
    return this.doInBackground_('logout', networkInfo, true);
  }

  private wrapPromise_ = (promise: Promise<any>, promiseId: number) => {
    promise.then((data) => {
      this.connector_.sendMessage('promise-response', {
        promiseId: promiseId,
        data: {
          success: true,
          response: data
        }
      });
    }, (data) => {
      this.connector_.sendMessage('promise-response', {
        promiseId: promiseId,
        data: {
          success: false,
          response: data
        }
      });
    });
  }

  private handleMessage_ = (name: string, data: panel_connector.CommandPayload) => {
    if (name === 'fire-signal') {
      this.state_.fire('core-signal', data.data); // a bit hacky, but oh well
    } else if (name === 'promise-response') {
      this.handlePromiseResponse_(data.promiseId, data.data);
    } else if (name === 'open-dialog') {
      this.wrapPromise_(this.state_.openDialog(data.data), data.promiseId);
    }
  }

  private handlePromiseResponse_ = (promiseId: number, data: { success: boolean, response: Object}) => {
    if (!this.promisesMap_[promiseId]) {
      console.error('Unexpected promise received');
      return;
    }

    if (data.success) {
      this.promisesMap_[promiseId].fulfill(data.response);
    } else {
      this.promisesMap_[promiseId].reject(data.response);
    }
    delete this.promisesMap_[promiseId];
  }

  private doInBackground_ = (name: string, data: Object, expectResponse: boolean = false): any => {
    var payload :panel_connector.CommandPayload = {
      data: data,
      promiseId: null
    };

    if (expectResponse) {
      var promiseId = new Date().valueOf(); // approximately unique
      payload.promiseId = promiseId;
    }

    this.connector_.sendMessage(name, payload);

    if (expectResponse) {
      return new Promise((F, R) => {
        this.promisesMap_[promiseId] = { fulfill: F, reject: R };
      });
    }
  }
}

class FirefoxBackgroundUiConnector implements panel_connector.BackgroundUiConnector {
  constructor(listener: panel_connector.MessageHandler) {
    ui_context.panelConnector.panelConnect(listener);
  }

  public sendMessage(name: string, data: Object) {
    return ui_context.panelConnector.sendMessageFromPanel(name, data);
  }
}

interface ChromeMessageFormat {
  name: string;
  data: Object;
}

class ChromeBackgroundUiConnector implements panel_connector.BackgroundUiConnector {
  private port: chrome.runtime.Port;

  constructor(listener: panel_connector.MessageHandler) {
    this.port = chrome.runtime.connect({ name: 'panel-to-extension' });
    this.port.onMessage.addListener(function(message: ChromeMessageFormat) {
      listener(message.name, message.data);
    });
  }

  public sendMessage(name: string, data: Object) {
    var message: ChromeMessageFormat = { name: name, data: data };
    this.port.postMessage(message);
  }
}
