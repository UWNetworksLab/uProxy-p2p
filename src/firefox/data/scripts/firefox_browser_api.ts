/**
 * firefox_browser_api.ts
 *
 * Firefox-specific implementation of the Browser API.
 * TODO(salomegeo): Figure out if it's possible to set proxy from content script.
 */

/// <reference path='../../../third_party/firefox/firefox.d.ts' />

import browser_api =  require('../../../interfaces/browser-api');
import user_interface = require('../../../generic_ui/scripts/ui');

var port :ContentScriptPort;

declare var ui :user_interface.UserInterface;

class FirefoxBrowserApi implements BrowserAPI {

  public browserSpecificElement;

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

  public startUsingProxy = (endpoint:net.Endpoint) => {
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

  public on(name :string, callback :Function) => {
    port.on(name, callback);
  }
}
