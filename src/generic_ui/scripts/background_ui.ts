import * as _ from 'lodash';

import CoreConnector from './core_connector';
import * as panel_connector from '../../interfaces/panel_connector';
import * as ui from '../../interfaces/ui';
import * as uproxy_core_api from '../../interfaces/uproxy_core_api';

interface FullfillAndReject {
  fulfill: Function;
  reject: Function;
};

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

  private promisesMap_: {[id: number]: FullfillAndReject} = {};

  constructor(browserPanelConnector: panel_connector.BrowserPanelConnector,
      core: CoreConnector) {
    this.panelConnector_ = new PanelConnector(browserPanelConnector);
    this.panelConnector_.addListener(this.handleMessage_);
    this.core_ = core;
  }

  public registerAsFakeBackground(fn: panel_connector.MessageHandler) {
    if (this.fakeBackgroundCallback_) {
      this.panelConnector_.removeListener(this.fakeBackgroundCallback_);
    }
    this.fakeBackgroundCallback_ = fn;
    this.panelConnector_.addListener(this.fakeBackgroundCallback_);
  }

  private handleMessage_ = (name: string, data: panel_connector.CommandPayload) => {
    switch (name) {
      case 'update-global-setting':
        this.core_.updateGlobalSetting(<uproxy_core_api.UpdateGlobalSettingArgs>data.data);
        break;
      case 'update-global-settings':
        this.core_.updateGlobalSettings(<uproxy_core_api.GlobalSettings>data.data);
        break;
      case 'restart':
        this.core_.restart();
        break;
      case 'logout':
        this.wrapPromise_(this.core_.logout(data.data), data.promiseId);
        break;
      case 'promise-response':
        this.handlePromiseResponse_(data.promiseId, data.data);
        break;
      /*
       * We do not have a generic error case here because we expect other
       * handlers to deal with events that are not programmed here yet.  In the
       * future, we may add that kind of error-checking.
       */
    }
  }

  /* actual BackgroundUi methods */
  public fireSignal = (signalName: string, data?: Object): void => {
    this.doInPanel_('fire-signal', { name: signalName, data: data });
  }

  public openDialog = (data: ui.DialogDescription): Promise<any> => {
    return this.doInPanel_('open-dialog', data, true);
  }

  public showToast = (
      toastMessage: string,
      unableToGet: boolean = false,
      unableToShare: boolean = false): void => {
    // This object must match the shape expected in root.ts.
    return this.fireSignal('show-toast', {
      toastMessage: toastMessage,
      unableToGet: unableToGet,
      unableToShare: unableToShare
    });
  }

  private wrapPromise_ = (promise: Promise<any>, promiseId: number) => {
    promise.then((data) => {
      this.panelConnector_.send('promise-response', {
        promiseId: promiseId,
        data: {
          success: true,
          response: data
        }
      });
    }, (data) => {
      this.panelConnector_.send('promise-response', {
        promiseId: promiseId,
        data: {
          success: false,
          response: data
        }
      });
    });
  }

  private handlePromiseResponse_ = (promiseId: number, data: { success: boolean, response: Object }) => {
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

  private doInPanel_ = (name: string, data: Object, expectResponse: boolean = false): any => {
    var promise: Promise<any> = null;
    var payload: panel_connector.CommandPayload = {
      data: data,
      promiseId: null
    };

    if (expectResponse) {
      var promiseId = new Date().valueOf(); // approximately unique
      payload.promiseId = promiseId;

      promise = new Promise((F, R) => {
        this.promisesMap_[promiseId] = { fulfill: F, reject: R };
      });
    }

    this.panelConnector_.send(name, payload);
    return promise;
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

  public send(name: string, data: panel_connector.CommandPayload): void {
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
