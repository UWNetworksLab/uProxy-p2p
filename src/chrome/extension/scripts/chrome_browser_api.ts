/// <reference path='../../../../../third_party/typings/index.d.ts'/>

/**
 * chrome_browser_api.ts
 *
 * Chrome-specific implementation of the Browser API.
 */

import browser_api = require('../../../interfaces/browser_api');
import BrowserAPI = browser_api.BrowserAPI;
import net = require('../../../lib/net/net.types');
import Constants = require('../../../generic_ui/scripts/constants');

enum PopupState {
    NOT_LAUNCHED,
    LAUNCHING,
    LAUNCHED
}

declare var Notification :any; //TODO remove this

class ChromeBrowserApi implements BrowserAPI {

  public browserSpecificElement = 'uproxy-app-missing';

  public canProxy = true;
  public hasInstalledThenLoggedIn = true;
  public supportsVpn = false;

  // For browser action.

  public ICON_DIR :string = 'icons/';

  public setIcon = (iconFile :string) : void => {
    chrome.browserAction.setIcon({
      path: {
        '19' : this.ICON_DIR + '19_' + iconFile,
        '38' : this.ICON_DIR + '38_' + iconFile,
      }
    });
  }

  // For proxy configuration.

  private preUproxyConfig_ :chrome.proxy.ProxyConfig = null;
  private running_ :boolean = false;

  // For managing popup.

  // Chrome Window ID given to the uProxy popup.
  private popupWindowId_ = chrome.windows.WINDOW_ID_NONE;
  // The URL to launch when the user clicks on the extension icon.
  private POPUP_URL = 'generic_ui/index.html';
  // When we last called chrome.windows.create (for logging purposes).
  private popupCreationStartTime_ = Date.now();

  private popupState_ = PopupState.NOT_LAUNCHED;

  public handlePopupLaunch :() => void;
  private onceLaunched_ :Promise<void>;

  constructor() {
    // use localhost
    chrome.proxy.settings.clear({scope: 'regular'});

    chrome.proxy.settings.get({}, (details) => {
      this.canProxy = this.canControlProxy_(details.levelOfControl);
    });

    chrome.proxy.settings.onChange.addListener((details) => {
      if (!this.canControlProxy_(details.levelOfControl)) {
        if (this.canProxy && this.running_) {
          // only emit the event if we are learning about this for the first
          // time and a proxy is currently active
          this.emit('proxyDisconnected');
        }
        this.canProxy = false;
      } else {
        this.canProxy = true;
      }
    });

    chrome.windows.onRemoved.addListener((closedWindowId) => {
      // If either the window launching uProxy, or the popup with uProxy
      // is closed, reset the IDs tracking those windows.
      if (closedWindowId == this.popupWindowId_) {
        this.popupWindowId_ = chrome.windows.WINDOW_ID_NONE;
        this.popupState_ = PopupState.NOT_LAUNCHED;
      }
    });

    chrome.browserAction.setBadgeBackgroundColor({color: '#009968'});
  }

  private canControlProxy_ = (level :string) :boolean => {
    return level === 'controllable_by_this_extension' ||
           level === 'controlled_by_this_extension';
  }

  public startUsingProxy =
      (endpoint: net.Endpoint, bypass: string[],
       opts: browser_api.ProxyConnectOptions) => {
    var config = {
      mode: 'fixed_servers',
      rules: {
        singleProxy: {
          scheme: 'socks5',
          host: endpoint.address,
          port: endpoint.port,
        },
        bypassList: bypass,
      }
    };

    console.log('Directing Chrome proxy settings to uProxy');
    this.running_ = true;
    chrome.proxy.settings.get({incognito:false},
      (details) => {
        this.preUproxyConfig_ = details.value;
        chrome.proxy.settings.set({
            value: config,
            scope: 'regular'
          }, () => {console.log('Successfully set proxy');});
      });
  };

  public stopUsingProxy = () => {
    if (this.running_) {
      console.log('Reverting Chrome proxy settings');
      this.running_ = false;
      chrome.proxy.settings.clear({ scope: 'regular' });
    }
  };

  // Other.

  public openTab = (url :string) => {
    if (url.indexOf(':') < 0) {
      url = chrome.extension.getURL(url);
    }

    chrome.tabs.create({url: url}, (tab) => {
      chrome.windows.update(tab.windowId, {focused: true});
    });
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
          chrome.tabs.update(tabs[i].id, {url: '../' + relativeUrl, active: true});
          return;
        }
      }
      chrome.tabs.create({url: '../' + relativeUrl});
    });
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
      chrome.windows.create({url: this.POPUP_URL,
                     type: 'popup',
                     width: 371,
                     height: 600}, this.newPopupCreated_);
      return this.onceLaunched_;
    } else if (this.popupState_ == PopupState.LAUNCHED) {
      // If the popup is already open, simply focus on it.
      chrome.windows.update(this.popupWindowId_, {focused: true});
      return Promise.resolve<void>();
    } else {
      console.log('Waiting for popup to launch...');
      return this.onceLaunched_;
    }
  }

  /**
    * Callback passed to chrome.windows.create.
    */
  private newPopupCreated_ = (popup :chrome.windows.Window) => {
    console.log('Time between browser icon click and popup launch (ms): ' +
        (Date.now() - this.popupCreationStartTime_));
    this.popupWindowId_ = popup.id;
    this.popupState_ = PopupState.LAUNCHED;
  }

  public showNotification = (text :string, tag :string) => {
    var notification =
        new Notification('uProxy', {
          body: text,
          icon: 'icons/38_' + Constants.DEFAULT_ICON,
          tag: tag
        });
    notification.onclick = () => {
      this.emit('notificationClicked', tag);
    };
    setTimeout(function() {
      notification.close();
    }, 5000);
  }

  public isConnectedToCellular = (): Promise<boolean> => {
    return Promise.resolve(false);
  }

  private events_ :{[name :string] :Function} = {};

  public on = (name :string, callback :Function) => {
    this.events_[name] = callback;
  }

  public emit = (name :string, ...args :Object[]) => {
    this.bringUproxyToFront().then(() => {
      if (name in this.events_) {
        this.events_[name].apply(null, args);
      } else {
        console.error('Attempted to trigger an unknown event', name);
      }
    });
  }

  public respond = (data :any, callback ?:Function, msg ?:string) : void => {
    callback && this.respond_(data, callback);
  }

  private respond_ = (data :any, callback :Function) : void => {
    callback(data);
  }

  public setBadgeNotification = (notification :string) => {
    chrome.browserAction.setBadgeText({text: notification});
  }
}

export = ChromeBrowserApi;
