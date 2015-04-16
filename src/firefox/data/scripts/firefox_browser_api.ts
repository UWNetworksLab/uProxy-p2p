/**
 * firefox_browser_api.ts
 *
 * Firefox-specific implementation of the Browser API.
 * TODO(salomegeo): Figure out if it's possible to set proxy from content script.
 */
/// <reference path='../../../interfaces/browser-api.d.ts' />
/// <reference path='../../../interfaces/firefox.d.ts' />
/// <reference path='../../../generic_ui/scripts/ui.ts' />

var port :ContentScriptPort;

declare var ui :UI.UserInterface;

class FirefoxBrowserApi implements BrowserAPI {

  public browserSpecificElement;

  constructor() {
    port.on('handleUrlData', function(url :string) {
      ui.handleUrlData(url);
    });

    port.on('notificationClicked', function(tag :string) {
      ui.handleNotificationClick(tag);
    });

    port.on('emitFulfilled', this.handleEmitFulfilled_);
    port.on('emitRejected', this.handleEmitRejected_);
  }

  // For browser icon.

  public setIcon = (iconFile :string) : void => {
    port.emit('setIcon',
        {
          "18": "./icons/19_" + iconFile,
          "36": "./icons/38_" + iconFile
        });
  }

  public openTab = (url :string) => {
    port.emit('openURL', url);
  }

  public launchTabIfNotOpen = (url :string) => {
    port.emit('launchTabIfNotOpen', url);
  }

  // For proxy configuration.
  // Sends message back to add-on environment, which handles proxy settings.

  public startUsingProxy = (endpoint:Net.Endpoint) => {
    port.emit('startUsingProxy', endpoint);
  }

  public stopUsingProxy = () => {
    port.emit('stopUsingProxy');
  }

  public bringUproxyToFront = () => {
    port.emit('showPanel');
  }

  public showNotification = (text :string, tag :string) => {
    port.emit('showNotification', { text: text, tag: tag });
  }

  public httpPost = (url :string, data :any, useDomainFronting: boolean) : Promise<void> => {
    return this.promiseEmit('httpPost', { url: url, data: data, useDomainFronting: useDomainFronting });
  }

  // Global unique promise ID.
  private promiseId_ :number = 1;
  private mapPromiseIdToFulfillAndReject_ :{[id :number] : FullfillAndReject} =
      {};

  interface FullfillAndReject {
    fulfill :Function;
    reject :Function;
  };

  /**
   * Send a Command from the UI to the Core, as a result of some user
   * interaction.  Command returns a promise that fulfills/rejects upon
   * an ack/reject from the backend.
   */
  public promiseEmit = (message :string, data ?:any)
      : Promise<any> => {
    var promiseId :number = ++(this.promiseId_);
    var payload = {
      data: data,
      promiseId: promiseId
    }
    console.log('Firefox emitting, expecting async return: ' + message,
        JSON.stringify(payload));

    // Create a new promise and store its fulfill and reject functions.
    var fulfillFunc :Function;
    var rejectFunc :Function;
    var promise :Promise<any> = new Promise<any>((F, R) => {
      fulfillFunc = F;
      rejectFunc = R;
    });
    // TODO: we may want to periodically remove garbage from this table,
    // or we we may want to reject promises after some timeout.
    this.mapPromiseIdToFulfillAndReject_[promiseId] = {
      fulfill: fulfillFunc,
      reject: rejectFunc
    };

    // Send request to backend.
    port.emit(message, payload);

    return promise;
  }

  private handleEmitFulfilled_ = (data :any) => {
    var promiseId = data.promiseId;
    console.log('promise emit fulfilled ' + promiseId);
    if (this.mapPromiseIdToFulfillAndReject_[promiseId]) {
      this.mapPromiseIdToFulfillAndReject_[promiseId]
          .fulfill(data.argsForCallback);
      delete this.mapPromiseIdToFulfillAndReject_[promiseId];
    } else {
      console.warn('fulfill not found ' + promiseId);
    }
  }

  private handleEmitRejected_ = (data :any) => {
    var promiseId = data.promiseId;
    console.log('promise emit rejected ' + promiseId);
    if (this.mapPromiseIdToFulfillAndReject_[promiseId]) {
      this.mapPromiseIdToFulfillAndReject_[promiseId]
          .reject(data.errorForCallback);
      delete this.mapPromiseIdToFulfillAndReject_[promiseId];
    } else {
      console.warn('reject not found ' + promiseId);
    }
  }



}
