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
  }

  // For browser icon.

  public setIcon = (iconFile :string) : void => {
    port.emit('setIcon',
        {
          "18": "./icons/19_" + iconFile,
          "36": "./icons/38_" + iconFile
        });
  }

  public openTab = (url ?:string) => {
    port.emit('openURL', url);
  }

  // For proxy configuration.
  // Sends message back to add-on environment, which handles proxy settings.

  public startUsingProxy = (endpoint:Net.Endpoint) => {
    port.emit('startUsingProxy', endpoint);
  }

  public stopUsingProxy = (askUser :boolean) => {
    port.emit('stopUsingProxy', askUser);
  }

  public bringUproxyToFront = () => {
    port.emit('showPanel');
  }

  public showNotification = (notificationText :string) => {
    port.emit('showNotification', {
      text: notificationText,
      iconURL: './icons/128_online.png'
    });
  }
}
