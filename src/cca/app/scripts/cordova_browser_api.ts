/// <reference path='../../../../../third_party/typings/chrome/chrome-app.d.ts'/>
/// <reference path='../../../../../third_party/typings/cordova/inappbrowser.d.ts'/>

/**
 * cordova_browser_api.ts
 *
 * Cordova-specific implementation of the Browser API.
 * Derived from chrome_browser_api.ts
 */

import browser_api = require('../../../interfaces/browser_api');
import BrowserAPI = browser_api.BrowserAPI;
import net = require('../../../../../third_party/uproxy-lib/net/net.types');
import Constants = require('../../../generic_ui/scripts/constants');

enum PopupState {
    NOT_LAUNCHED,
    LAUNCHING,
    LAUNCHED
}

declare var Notification :any; //TODO remove this

class CordovaBrowserApi implements BrowserAPI {

  public browserSpecificElement = "";

  public canProxy = true;

  // TODO: Set this to false if we detect that uProxy has just been installed.
  // https://github.com/uProxy/uproxy/issues/1832
  public hasInstalledThenLoggedIn = true;

  public setIcon = (iconFile :string) : void => {
  }

  // The URL for the page that renders the UI.  For terminological consistency,
  // the UI is referred to as the "popup", even though it is persistent and
  // full-screen.
  private POPUP_URL = "index.html";
  // When we tried to create UI.
  private popupCreationStartTime_ = Date.now();

  private popupState_ = PopupState.NOT_LAUNCHED;

  public handlePopupLaunch :() => void;
  private onceLaunched_ :Promise<void>;

  constructor() {
  }

  public startUsingProxy = (endpoint:net.Endpoint) => {
    if (!chrome.proxy) {
      console.log('No proxy setting support; ignoring start command');
      return;
    }

    chrome.proxy.settings.set({
      scope: "regular",
      value: {
        mode: "fixed_servers",
        rules: {
          singleProxy: {
            scheme: "socks5",
            host: endpoint.address,
            port: '' + endpoint.port
          }
        }
      }
    }, (response:Object) => {
      console.log('Set proxy response:', response);
      // Open the in-app browser through the proxy.
      cordova.InAppBrowser.open('https://www.uproxy.org/', '_blank');
    });
  };

  public stopUsingProxy = () => {
    if (!chrome.proxy) {
      console.log('No proxy setting support; ignoring stop command');
      return;
    }

    chrome.proxy.settings.clear({scope: "regular"}, () => {
      console.log('Cleared proxy settings');
    });
  };

  public openTab = (url :string) => {
    cordova.InAppBrowser.open(url, '_blank');
  }

  public launchTabIfNotOpen = (relativeUrl :string) => {
    // TODO: Figure out what this means in Cordova.
  }

  public bringUproxyToFront = () : Promise<void> => {
    // In Cordova, this function is badly misnamed.  Rather than bringing the
    // window to front, it actually creates the window the first time it is
    // called, and otherwise has no effect.
    if (this.popupState_ === PopupState.NOT_LAUNCHED) {
      this.popupState_ = PopupState.LAUNCHING;
      this.popupCreationStartTime_ = Date.now();
      // If neither popup nor Chrome window are open (e.g. if uProxy is launched
      // after webstore installation), then allow the popup to open at a default
      // location.
      this.onceLaunched_ = new Promise<void>((F, R) => {
        this.handlePopupLaunch = F;
      });
      console.log('Creating window');
      chrome.app.window.create(this.POPUP_URL, {},
          this.newPopupCreated_);
      return this.onceLaunched_;
    } else {
      // Once the app has started, all subsequent calls to bringUproxyToFront
      // are no-ops.
      return this.onceLaunched_;
      console.log("Waiting for popup to launch...");
    }
  }

  /**
    * Callback passed to chrome.app.window.create.
    */
  private newPopupCreated_ = (popup :chrome.app.window.AppWindow) => {
    console.log("Time between browser icon click and popup launch (ms): " +
        (Date.now() - this.popupCreationStartTime_));
    this.popupState_ = PopupState.LAUNCHED;
    this.handlePopupLaunch();
  }

  public showNotification = (text :string, tag :string) => {
    if (typeof Notification === 'undefined') {
      // Notifications are only supported when using Crosswalk
      console.log('Can\'t show notifications in webview mode');
      return;
    }

    var notification =
        new Notification('uProxy', {
          body: text,
          icon: 'icons/38_' + Constants.DEFAULT_ICON,
          tag: tag
        });
    notification.onclick = () => {
      this.emit_('notificationClicked', tag);
    };
    setTimeout(function() {
      notification.close();
    }, 5000);
  }

  public setBadgeNotification = (notification:string) :void => {
    // TODO: is there a sensible way to handle this on Android.
  }

  private events_ :{[name :string] :Function} = {};

  public on = (name :string, callback :Function) => {
    this.events_[name] = callback;
  }

  private emit_ = (name :string, ...args :Object[]) => {
    if (name in this.events_) {
      this.events_[name].apply(null, args);
    } else {
      console.error('Attempted to trigger an unknown event', name);
    }
  }

  public frontedPost = (data :any,
                        externalDomain :string,
                        cloudfrontDomain :string,
                        cloudfrontPath = "") : Promise<void> => {
    return Promise.reject(new Error('TODO: Fronted post in Cordova'));
  }
}

export = CordovaBrowserApi;
