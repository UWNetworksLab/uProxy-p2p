/**
 * firefox_browser_api.ts
 *
 * Includes:
 * Firefox-specific implementation of the Notifications API.
 * Sends message back to add-on environment, which handles proxy settings.
 */
/// <reference path='../../../interfaces/browser-api.d.ts' />
/// <reference path='../../../interfaces/firefox.d.ts' />

class FirefoxBrowserApi implements BrowserAPI {

  var port :ContentScriptPort;

  public setIcon = (iconFile :string) : void => {
    port.emit('setIcon', iconFile);
  }

  constructor() {
  }

  public startUsingProxy = (endpoint:Net.Endpoint) => {
    port.emit('startUsingPorxy', endpoint);
  };

  public stopUsingProxy = (askUser :boolean) => {
    port.emit('startUsingPorxy', askUser);
  };

  public openFaq = (pageAnchor :string) => {}
}
