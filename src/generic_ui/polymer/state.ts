/// <reference path='./context.d.ts' />
/// <reference path='../../../../third_party/typings/browser.d.ts'/>
/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

import panel_connector = require('../../interfaces/panel_connector');
import uproxy_core_api = require('../../interfaces/uproxy_core_api');

var background: panel_connector.BackgroundUiConnector = null;

Polymer({
  ready: function() {
    this.ui = ui_context.ui;
    this.core = ui_context.core;
    this.model = ui_context.model;

    if (background) {
      return;
    }

    /*
     * one of these elements should be bound as a message listener, it should
     * not matter which one.  If it turns out it does matter which one, we'll
     * put an attribute for that.
     */
    if (window.chrome) {
      background = new ChromeBackgroundUiConnector(this.handleMessage.bind(this));
    } else {
      background = new FirefoxBackgroundUiConnector(this.handleMessage.bind(this));
    }
  },
  handleMessage: function(name: string, data: Object) {
    if (name === 'fire-signal') {
      this.fire('core-signal', data);
    }
  },

  updateGlobalSettings: function(settings: uproxy_core_api.GlobalSettings) {
    background.sendMessage('update-global-settings', settings);
  },
  restart: function() {
    background.sendMessage('restart', null);
  },
  logoutAll: function(getConfirmation: boolean) {
    background.sendMessage('logout-all', { getConfirmation: getConfirmation });
  }
});

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
