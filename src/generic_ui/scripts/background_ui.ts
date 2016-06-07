/// <reference path='../../../../third_party/typings/browser.d.ts' />

import _ = require('lodash');

import CoreConnector = require('./core_connector');
import panel_connector = require('../../interfaces/panel_connector');
import uproxy_core_api = require('../../interfaces/uproxy_core_api');

/**
 * The BackgroundUI class
 *
 * Right now, this is serving as more of a connector between ui.ts (fake
 * background UI) and the panel.
 *
 * In the future, we should move all of the logic that is currently in ui.ts
 * and needs to actually run in the background to this class and the rest into
 * Polymer elements or code in that area.  This is going to be a slow transition
 * though so we have the `registerAsFakeBackground` callback for ui.ts to use
 * for now so that it can also handle things coming in messages from the panel.
 */
export class BackgroundUi {
  private core_: CoreConnector;
  private fakeBackgroundCallback_: panel_connector.MessageHandler;
  private panelConnector_: PanelConnector;

  constructor(browserPanelConnector: panel_connector.BrowserPanelConnector,
      core: CoreConnector) {
    this.panelConnector_ = new PanelConnector(browserPanelConnector);
    this.panelConnector_.addListener(this.handleSignalFromPanel);
    this.core_ = core;
  }

  public registerAsFakeBackground(fn: panel_connector.MessageHandler) {
    if (this.fakeBackgroundCallback_) {
      this.panelConnector_.removeListener(this.fakeBackgroundCallback_);
    }
    this.fakeBackgroundCallback_ = fn;
    this.panelConnector_.addListener(this.fakeBackgroundCallback_);
  }

  private handleSignalFromPanel = (name: string, data: Object) => {
    switch(name) {
      case 'update-global-settings':
        this.core_.updateGlobalSettings(<uproxy_core_api.GlobalSettings>data);
        break;
      case 'restart':
        this.core_.restart();
        break;
    }
  }

  /* actual BackgroundUi methods */
  public fireSignal(signalName: string, data?: Object): void {
    this.panelConnector_.send('fire-signal', { name: signalName, data: data });
  }
}

class PanelConnector {
  private panels_: panel_connector.Panel[] = [];
  private backgroundCallbacks_: Function[] = [];

  constructor(connector: panel_connector.BrowserPanelConnector) {
    connector.startListening(
        (panel: panel_connector.Panel) => {
          this.panels_.push(panel);
        }, (name: string, data: Object) => {
          this._emit(name, data);
        }, (panel: panel_connector.Panel) => {
          _.remove(this.panels_, (el: panel_connector.Panel) => { return el === panel; });
        });
  }

  public send(name: string, data: Object = null): void {
    //TODO error checking
    this.panels_.forEach((panel) => {
      panel.sendMessage(name, data);
    });
  }

  public addListener(fn: panel_connector.MessageHandler): void {
    this.backgroundCallbacks_.push(fn);
  }

  /*
   * This is added as a hack while our current UI object has no ability to
   * unregister itself
   */
  public removeAllListeners(): void {
    this.backgroundCallbacks_.length = 0;
  }

  public removeListener(fn: panel_connector.MessageHandler): void {
    _.remove(this.backgroundCallbacks_, (el: Function) => { return el === fn; });
  }

  private _emit(name: string, data: Object): void {
    this.backgroundCallbacks_.forEach((fn) => {
      fn(name, data);
    });
  }
}
