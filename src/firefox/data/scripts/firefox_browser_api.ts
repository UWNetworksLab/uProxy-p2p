/**
 * firefox_browser_api.ts
 *
 * Firefox-specific implementation of the Browser API.
 * TODO(salomegeo): Figure out if it's possible to set proxy from content script.
 */
/// <reference path='../../../interfaces/browser-api.d.ts' />
/// <reference path='../../../interfaces/firefox.d.ts' />

var port :ContentScriptPort;

class FirefoxBrowserApi implements BrowserAPI {

  constructor() {
  }

  // For browser icon.

  public setIcon = (iconFile :string) : void => {
    port.emit('setIcon',
        {
          "18": "./icons/19_" + iconFile,
          "32": "./icons/32_" + UI.DEFAULT_ICON,
          "36": "./icons/38_" + iconFile
        });
  }

  // For FAQ.

  public openFaq = (pageAnchor ?:string) => {}

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
}
