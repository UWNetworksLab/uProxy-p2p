/// <reference path='../../../../../third_party/typings/browser.d.ts'/>
/// <reference path='../../../../../third_party/typings/cordova/themeablebrowser.d.ts'/>
/// <reference path='../../../../../third_party/typings/cordova/webintents.d.ts'/>

/**
 * cordova_browser_api.ts
 *
 * Cordova-specific implementation of the Browser API.
 * Derived from chrome_browser_api.ts
 */

import browser_api = require('../../../interfaces/browser_api');
import ProxyDisconnectInfo = browser_api.ProxyDisconnectInfo;
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

  private browser_ :Window = null;

  constructor() {
    chrome.notifications.onClicked.addListener((tag) => {
      this.emit_('notificationclicked', tag);
    });

    // Cordova APIs are not guaranteed to be available until after the
    // deviceready event fires.  This is a special event: if you miss it,
    // and add your listener after the event has already fired, Cordova
    // guarantees that your listener will run immediately.
    // We listen to window.top because CCA runs application code in an iframe,
    // but deviceready never fires on the iframe.
    window.top.document.addEventListener('deviceready', () => {
      // We use the copy of webintent attached to the top-level window, instead
      // of the window for this iframe, because the iframe's copy of webintent
      // is populated asynchronously and may not be ready yet when deviceready
      // fires.
      window.top.webintent.getUri(this.onUrl_);  // Handle URL already received.
      window.top.webintent.onNewIntent(this.onUrl_);  // Handle future URLs.
    }, false);
  }

  private onUrl_ = (url:string) => {
    // "request/" and "offer/" require trailing slashes. "invite" does not.
    var urlMatch = /(?:http|https)\:\/\/(?:www\.)?uproxy\.org\/(request\/|offer\/|invite).*/;
    if (!url) {
      // This is expected because webintent.getUri() calls back with null if
      // there is no URI for this startup, i.e. normal startup.
      return;
    }
    var match = url.match(urlMatch);
    if (!match) {
      // Unrecognized URL.  This is an error, because only matching URLs are
      // listed in our <intent-filter> in config.xml.
      console.warn('Unmatched intent URL: ' + url);
      return;
    }
    if (match[1] === 'invite') {
      this.emit_('inviteUrlData', url);
    } else if (match[1] === 'request/' || match[1] === 'offer/') {
      this.emit_('copyPasteUrlData', url);
    } else {
      // This code is unreachable.
      console.warn('Bug encountered while processing url: ' + url);
    }
  }

  public isConnectedToCellular = () : Promise<boolean> => {
    return new Promise<boolean>((F, R) => {
        var isConnectedToCellular = false;
        chrome.system.network.getNetworkInterfaces((networkIfaceArray) => {
          for (var i = 0; i < networkIfaceArray.length; i++) {
            var iface = networkIfaceArray[i];
            if (iface.name.substring(0, 5) === 'rmnet') {
              console.log('User Connected to cellular network.');
              isConnectedToCellular = true;
              break;
            }
          }
          F(isConnectedToCellular);
        });
      });
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
            port: endpoint.port
          }
        }
      }
    }, (response:Object) => {
      console.log('Set proxy response:', response);
      // Open the in-app browser through the proxy.
      this.openTab('https://news.google.com/');
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
    if (this.browser_) {
      return;
    }
    this.browser_ = cordova.ThemeableBrowser.open(url, '_blank', {
      statusbar: {
        color: '#ffffffff'
      },
      toolbar: {
        height: 44,
        color: '#f0f0f0ff'
      },
      title: {
        color: '#003264ff',
        showPageTitle: false
      },
      backButton: {
        image: 'back',
        imagePressed: 'back_pressed',
        align: 'left'
      },
      forwardButton: {
        image: 'forward',
        imagePressed: 'forward_pressed',
        align: 'left'
      },
      closeButton: {
        image: 'close',
        imagePressed: 'close_pressed',
        align: 'right',
        event: 'closePressed'
      },
      backButtonCanClose: false
    });

    this.browser_.addEventListener(cordova.ThemeableBrowser.EVT_ERR, function(e) {
      console.error(e);
    });
    this.browser_.addEventListener(cordova.ThemeableBrowser.EVT_WRN, function(e) {
      console.log(e);
    });
    this.browser_.addEventListener('closePressed', (e) => {
      this.browser_ = null;
      this.stopUsingProxy();
      this.emit_('proxyDisconnected', {deliberate: true});
    });
    this.browser_.addEventListener('loadstart', (e:any) => {
      // If the browser opens the autoclose URL, kill it.
      if (e.url.indexOf('https://www.uproxy.org/autoclose') === 0) {
        this.browser_.close();
        this.browser_ = null;
        // TODO: What if this happens during a proxying session?
      }
    });
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
      console.log("Waiting for popup to launch...");
      return this.onceLaunched_;
    }
  }

  /**
    * Callback passed to chrome.app.window.create.
    */
  private newPopupCreated_ = (popup :chrome.app.window.AppWindow) => {
    console.log("Time between browser icon click and popup launch (ms): " +
        (Date.now() - this.popupCreationStartTime_));
    this.popupState_ = PopupState.LAUNCHED;
  }

  public showNotification = (text :string, tag :string) => {
    // We use chrome.notifications because the HTML5 Notification API is not
    // available (and not polyfilled) in WebViews, so it only works in
    // Crosswalk.
    chrome.notifications.create(tag, {
      type: 'basic',
      iconUrl: 'icons/38_' + Constants.DEFAULT_ICON,
      title: 'uProxy',  // Mandatory attribute
      message: text
    }, (tag:string) => {});
  }

  public setBadgeNotification = (notification:string) :void => {
    // TODO: is there a sensible way to handle this on Android.
  }

  private events_ :{[name :string] :Function} = {};

  // Queue of any events emitted that don't have listeners yet.  This is needed
  // for the 'inviteUrlData' event, if the invite URL caused uProxy to open,
  // because otherwise the event would be emitted before UserInterface has a
  // chance to set a listener on it.
  private pendingEvents_ :{[name :string] :Object[][]} = {};

  public on = (name :string, callback :Function) => {
    if (name in this.events_) {
      console.warn('Overwriting Cordova Browser API event listener: ' + name);
    }
    this.events_[name] = callback;
    if (name in this.pendingEvents_) {
      this.pendingEvents_[name].forEach((args:Object[]) => {
        callback.apply(null, args);
      });
      delete this.pendingEvents_[name];
    }
  }

  public emitCommon = (name :string, data ?:any) => {
    chrome.runtime.sendMessage({name: data});
  }

  private emit_ = (name :string, ...args :Object[]) => {
    if (name in this.events_) {
      this.events_[name].apply(null, args);
    } else {
      if (!(name in this.pendingEvents_)) {
        this.pendingEvents_[name] = [];
      }
      this.pendingEvents_[name].push(args);
    }
  }
}

export = CordovaBrowserApi;
