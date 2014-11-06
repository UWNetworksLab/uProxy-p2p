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

  public setIcon = (iconFile :string) : void => {
    port.emit('setIcon', iconFile);
  }

  public openFaq = (pageAnchor :string) => {}

  // Proxy configuration methods.
  // Sends message back to add-on environment, which handles proxy settings.

  public startUsingProxy = (endpoint:Net.Endpoint) => {
    port.emit('startUsingPorxy', endpoint);
  }

  public stopUsingProxy = (askUser :boolean) => {
    port.emit('startUsingPorxy', askUser);
  }
}
