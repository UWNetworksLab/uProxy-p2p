/**
 * chrome_browser_api.ts
 *
 * Chrome-specific implementation of the Browser API.
 */
/// <reference path='../../../interfaces/browser-api.d.ts' />
/// <reference path='../../../third_party/typings/chrome/chrome.d.ts'/>
/// <reference path='../../../networking-typings/communications.d.ts' />


enum PopupState {
    NOT_LAUNCHED,
    LAUNCHING,
    LAUNCHED
}

class ChromeBrowserApi implements BrowserAPI {

  public browserSpecificElement = "uproxy-app-missing";

  // For browser action.

  public ICON_DIR :string = 'icons/';

  public setIcon = (iconFile :string) : void => {
    chrome.browserAction.setIcon({
      path: {
        "19" : this.ICON_DIR + "19_" + iconFile,
        "38" : this.ICON_DIR + "38_" + iconFile,
      }
    });
  }

  // For proxy configuration.

  private preUproxyConfig_ :chrome.proxy.ProxyConfig = null;
  private uproxyConfig_ :chrome.proxy.ProxyConfig = null;
  private running_ :boolean = false;

  // For managing popup.

  // Chrome Window ID given to the uProxy popup.
  private popupWindowId_ = chrome.windows.WINDOW_ID_NONE;
  // The URL to launch when the user clicks on the extension icon.
  private POPUP_URL = "index.html";
  // When we last called chrome.windows.create (for logging purposes).
  private popupCreationStartTime_ = Date.now();

  private popupState_ = PopupState.NOT_LAUNCHED;

  constructor() {
    // use localhost
    this.uproxyConfig_ = {
      mode: "fixed_servers",
      rules: {
        singleProxy: {
          scheme: "socks5",
          host: null,
          port: null
        }
      }
    };

    // TODO: tsd's chrome definition is missing .clear on ChromeSetting, which
    // is why we employ a hacky thing here.
    chrome.proxy.settings['clear']({scope: 'regular'});

    chrome.windows.onRemoved.addListener((closedWindowId) => {
      // If either the window launching uProxy, or the popup with uProxy
      // is closed, reset the IDs tracking those windows.
      if (closedWindowId == this.popupWindowId_) {
        this.popupWindowId_ = chrome.windows.WINDOW_ID_NONE;
        this.popupState_ = PopupState.NOT_LAUNCHED;
      } else if (closedWindowId == mainWindowId) {
        mainWindowId = chrome.windows.WINDOW_ID_NONE;
      }
    });
  }

  public startUsingProxy = (endpoint:Net.Endpoint) => {
    if (this.running_ == false) {
      this.uproxyConfig_.rules.singleProxy.host = endpoint.address;
      this.uproxyConfig_.rules.singleProxy.port = endpoint.port;
      console.log('Directing Chrome proxy settings to uProxy');
      this.running_ = true;
      chrome.proxy.settings.get({incognito:false},
        (details) => {
          // TODO (lucyhe): Remove this if statement when Chrome issue 448172
          // is resolved and we can safely assume that details is defined.
          if (details) {
            this.preUproxyConfig_ = details.value;
          } else {
            this.preUproxyConfig_ = {mode: "system"};
            console.warn('Current proxy settings undefined. Received error: ' +
              chrome.runtime.lastError.message);
          }
          chrome.proxy.settings.set({
              value: this.uproxyConfig_,
              scope: 'regular'
            }, () => {console.log('Successfully set proxy');});
        });
    }
  };

  public stopUsingProxy = (askUser :boolean) => {
    if (askUser && this.running_ == true) {
      // Create a tab which prompts the user to decide if they want
      // to reset their proxy config.
      this.launchTabIfNotOpen("disconnected.html");
    } else if (!askUser && this.running_ == true) {
      this.revertProxySettings_();
    }
  };

  private revertProxySettings_ = () => {
    if (this.running_ == true) {
      console.log('Reverting Chrome proxy settings');
      this.running_ = false;
      chrome.proxy.settings.set({
        value: this.preUproxyConfig_,
        scope: 'regular'
      });
    }
  };

  // Other.

  public openTab = (url :string) => {
    chrome.tabs.create({url: url});
  }

  /**
    * Launch a tab with the url if no existing tab is open with that url.
    * @param relativeUrl must refer to a local page and should be relative
    *                    to the extension URL.
    */
  public launchTabIfNotOpen = (relativeUrl :string) => {
    chrome.tabs.query({currentWindow: true}, function(tabs){
      for (var i = 0; i < tabs.length; i++) {
        if (tabs[i].url == chrome.extension.getURL(relativeUrl)) {
          chrome.tabs.update(tabs[i].id, {url: "../" + relativeUrl, active: true});
          return;
        }
      }
      chrome.tabs.create({url: "../" + relativeUrl});
    });
  }

  public bringUproxyToFront = () => {
    if (this.popupState_ == PopupState.NOT_LAUNCHED
        && mainWindowId == chrome.windows.WINDOW_ID_NONE) {
      this.popupState_ = PopupState.LAUNCHING;
      this.popupCreationStartTime_ = Date.now();
      // If neither popup nor Chrome window are open (e.g. if uProxy is launched
      // after webstore installation), then allow the popup to open at a default
      // location.
      chrome.windows.create({url: this.POPUP_URL,
                     type: "popup",
                     width: 371,
                     height: 600}, this.newPopupCreated_);

    } else if (this.popupState_ == PopupState.NOT_LAUNCHED
        && mainWindowId != chrome.windows.WINDOW_ID_NONE) {
      this.popupState_ = PopupState.LAUNCHING;
      this.popupCreationStartTime_ = Date.now();
      // If the popup is not open, but uProxy is being launched from a Chrome
      // window, open the popup under the extension icon in that window.
      chrome.windows.get(mainWindowId, (windowThatLaunchedUproxy) => {
        if (windowThatLaunchedUproxy) {
          // TODO (lucyhe): test this positioning in Firefox & Windows.
          var popupTop = windowThatLaunchedUproxy.top + 70;
          var popupLeft = windowThatLaunchedUproxy.left + windowThatLaunchedUproxy.width - 430;
          chrome.windows.create({url: this.POPUP_URL,
                                 type: "popup",
                                 width: 371,
                                 height: 600,
                                 top: popupTop,
                                 left: popupLeft}, this.newPopupCreated_);
        }
      });
    } else if (this.popupState_ == PopupState.LAUNCHED) {
      // If the popup is already open, simply focus on it.
      chrome.windows.update(this.popupWindowId_, {focused: true});
    } else {
      console.log("Waiting for popup to launch...");
    }
  }

  /**
    * Callback passed to chrome.windows.create.
    */
  private newPopupCreated_ = (popup) => {
    console.log("Time between browser icon click and popup launch (ms): " +
        (Date.now() - this.popupCreationStartTime_));
    this.popupWindowId_ = popup.id;
    this.popupState_ = PopupState.LAUNCHED;
  }

  public showNotification = (notificationText :string) => {
    var notification =
        new Notification('uProxy', { body: notificationText,
                         icon: 'icons/38_' + UI.DEFAULT_ICON});
    setTimeout(function() {
      notification.close();
    }, 5000);
  }
}
