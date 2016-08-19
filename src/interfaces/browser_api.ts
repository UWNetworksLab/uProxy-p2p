/// <reference path='../../third_party/typings/index.d.ts' />

import net = require('../lib/net/net.types');

// Describes the interface for functions that have different implications
// for different browsers.

export interface BrowserAPI {
  // Configuration and control of the browsers proxy settings.
  startUsingProxy(
    endpoint: net.Endpoint, bypass: string[], opts: ProxyConnectOptions): void;
  stopUsingProxy() :void;
  // Set the browser icon for the extension/add-on.
  setIcon(iconFile :string) :void;
  // Open a new tab if it is not already open
  launchTabIfNotOpen(url :string) :void;
  // Open a new tab
  openTab(url :string) :void;
  bringUproxyToFront() :void;
  isConnectedToCellular(): Promise<boolean>;
  // TODO: write comment to explain what browserSpecificElement is.
  browserSpecificElement :string;

  canProxy :boolean;
  // Whether user has installed and logged into uProxy.
  hasInstalledThenLoggedIn :boolean;
  // Whether platform supports VPN mode.
  supportsVpn: boolean;

  /*
   * tag is used to uniquely identify notifications.  If it is a json-encoded
   * object with information on the notification, it should be used to
   * determine how to handle clicks to the notification
   */
  showNotification(text :string, tag :string) :void;

  on(name: string, callback: Function): void;
  on(name: 'inviteUrlData', callback: (url: string) => void): void;
  on(name :'notificationClicked', callback :(tag :string) => void) :void;
  on(name :'proxyDisconnected', callback :(info?:ProxyDisconnectInfo) => void) :void;

  // should be called when popup is launched and ready for use
  handlePopupLaunch() :void;

  // Overlay the given text as a "badge" over the uProxy extension icon.
  // The notification can be up to 4 characters.
  setBadgeNotification(notification :string) :void;

  // Cross-browser "respond" method, for responding to messages sent from
  // content scripts.
  // In Chrome, a callback will be supplied, which will be called with the
  // given response data.
  // In Firefox, since only JSON-serializable data (i.e. no callbacks) can be
  // passed, a message will be supplied instead, which will be emitted with
  // the given response data.
  respond(data :any, callback ?:Function, msg ?:string) :void;

  // This should close any uProxy UI window
  exit(): void;
}

// Describes the user-initiated mode to access a proxy.
export enum ProxyAccessMode {
  NONE = 100,
  IN_APP,
  VPN
};

// User options for connecting to a proxy.
// Packaged as an interface for forward-compatibility.
export interface ProxyConnectOptions {
  accessMode: ProxyAccessMode;
}

// Info associated with the 'proxyDisconnect' event.
// This single bit is packaged as an interface for forward-compatibility.
export interface ProxyDisconnectInfo {
  deliberate :boolean;
}
