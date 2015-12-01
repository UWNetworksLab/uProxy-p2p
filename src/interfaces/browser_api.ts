/// <reference path='../../../third_party/typings/es6-promise/es6-promise.d.ts' />

import net = require('../../../third_party/uproxy-lib/net/net.types');

// Describes the interface for functions that have different implications
// for different browsers.

export interface BrowserAPI {
  // Configuration and control of the browsers proxy settings.
  startUsingProxy(endpoint:net.Endpoint) :void;
  stopUsingProxy() :void;
  // Set the browser icon for the extension/add-on.
  setIcon(iconFile :string) :void;
  // Open a new tab if it is not already open
  launchTabIfNotOpen(url :string) :void;
  // Open a new tab
  openTab(url :string) :void;
  bringUproxyToFront() :void;
  // TODO: write comment to explain what browserSpecificElement is.
  browserSpecificElement :string;

  canProxy :boolean;
  // Whether user has installed and logged into uProxy.
  hasInstalledThenLoggedIn :boolean;

  /*
   * tag is used to uniquely identify notifications.  If it is a json-encoded
   * object with information on the notification, it should be used to
   * determine how to handle clicks to the notification
   */
  showNotification(text :string, tag :string) :void;

  /*
   * Make a domain fronted POST request to cloudfrontDomain/cloudfrontPath.
   *
   * externalDomain is visible on the wire, and used to 'front' the request
   * to Cloudfront. externalDomain should end in a forward slash.
   * cloudfrontPath should not start with a leading forward slash.
   */
  frontedPost(data :any, externalDomain :string, cloudfrontDomain :string,
           cloudfrontPath ?:string) : Promise<void>;

  on(name: string, callback: Function): void;
  on(name: 'inviteUrlData', callback: (url: string) => void): void;
  on(name: 'copyPasteUrlData', callback: (url: string) => void): void;
  on(name :'notificationClicked', callback :(tag :string) => void) :void;
  on(name :'proxyDisconnected', callback :(info?:ProxyDisconnectInfo) => void) :void;

  // should be called when popup is launched and ready for use
  handlePopupLaunch() :void;

  // Overlay the given text as a "badge" over the uProxy extension icon.
  // The notification can be up to 4 characters.
  setBadgeNotification(notification :string) :void;
}

// Info associated with the 'proxyDisconnect' event.
// This single bit is packaged as an interface for forward-compatibility.
export interface ProxyDisconnectInfo {
  deliberate :boolean;
}
