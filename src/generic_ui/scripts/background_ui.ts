/// <reference path='../../../../third_party/typings/browser.d.ts' />

import _ = require('lodash');

import CoreConnector = require('./core_connector');
import panel_connector = require('../../interfaces/panel_connector');
import uproxy_core_api = require('../../interfaces/uproxy_core_api');

export class BackgroundUi {
  private core: CoreConnector;
  private fakeBackgroundCallback: panel_connector.MessageHandler;
  private panelConnector: PanelConnector;

  constructor(browserPanelConnector: panel_connector.BrowserPanelConnector,
      core: CoreConnector) {
    this.panelConnector = new PanelConnector(browserPanelConnector);
    this.panelConnector.addListener(this.handleSignalFromPanel);
    this.core = core;
  }

  public registerAsFakeBackground(fn: panel_connector.MessageHandler) {
    if (this.fakeBackgroundCallback) {
      this.panelConnector.removeListener(this.fakeBackgroundCallback);
    }
    this.fakeBackgroundCallback = fn;
    this.panelConnector.addListener(this.fakeBackgroundCallback);
  }

  private handleSignalFromPanel = (name: string, data: Object) => {
    switch(name) {
      case 'update-global-settings':
        this.core.updateGlobalSettings(<uproxy_core_api.GlobalSettings>data);
        break;
      case 'restart':
        this.core.restart();
        break;
    }
  }

  /* actual BackgroundUi methods */
  public fireSignal(signalName: string, data?: Object): void {
    this.panelConnector.send('fire-signal', { name: signalName, data: data });
  }
}

class PanelConnector {
  private _panels: panel_connector.Panel[] = [];
  private _backgroundCallbacks: Function[] = [];

  constructor(connector: panel_connector.BrowserPanelConnector) {
    connector.startListening(
        (panel: panel_connector.Panel) => {
          this._panels.push(panel);
        }, (name: string, data: Object) => {
          this._emit(name, data);
        }, (panel: panel_connector.Panel) => {
          _.remove(this._panels, (el: panel_connector.Panel) => { return el === panel; });
        });
  }

  public send(name: string, data: Object = null): void {
    //TODO error checking
    this._panels.forEach((panel) => {
      panel.sendMessage(name, data);
    });
  }

  public addListener(fn: panel_connector.MessageHandler): void {
    this._backgroundCallbacks.push(fn);
  }

  /*
   * This is added as a hack while our current UI object has no ability to
   * unregister itself
   */
  public removeAllListeners(): void {
    this._backgroundCallbacks.length = 0;
  }

  public removeListener(fn: panel_connector.MessageHandler): void {
    _.remove(this._backgroundCallbacks, (el: Function) => { return el === fn; });
  }

  private _emit(name: string, data: Object): void {
    this._backgroundCallbacks.forEach((fn) => {
      fn(name, data);
    });
  }
}
