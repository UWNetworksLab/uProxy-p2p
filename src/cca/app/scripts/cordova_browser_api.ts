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

/// <reference path='../../../../third_party/typings/chrome/chrome-app.d.ts'/>
/// <reference path='../../../../networking-typings/communications.d.ts' />

enum PopupState {
    NOT_LAUNCHED,
    LAUNCHING,
    LAUNCHED
}

declare var Notification :any; //TODO remove this

class CordovaBrowserApi implements BrowserAPI {

  public browserSpecificElement = "";

  public canProxy = true;

  public setIcon = (iconFile :string) : void => {
  }

  public ui :chrome.app.window.AppWindow;

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
    // TODO: Implement getter support, possibly using "redsocks".
  };

  public stopUsingProxy = () => {
  };

  // Other.

  public openTab = (url :string) => {
    // TODO: Figure out what this means in Cordova.
  }

  public launchTabIfNotOpen = (relativeUrl :string) => {
    // TODO: Figure out what this means in Cordova.
  }

  public bringUproxyToFront = () : Promise<void> => {
    if (this.popupState_ == PopupState.NOT_LAUNCHED) {
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
    } else if (this.popupState_ == PopupState.LAUNCHED) {
      // If the popup is already open, simply focus on it.
      //chrome.windows.update(this.popupWindowId_, {focused: true});
      return Promise.resolve<void>();
    } else {
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
    this.ui = popup;
    this.popupState_ = PopupState.LAUNCHED;
    this.handlePopupLaunch();
  }

  public showNotification = (text :string, tag :string) => {
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
