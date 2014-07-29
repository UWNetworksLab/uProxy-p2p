/**
 * firefox_browser_action.ts
 *
 * This is the Firefox-specific implementation of the BrowserAction API.
 */
/// <reference path='../../../interfaces/browser_action.d.ts' />
/// <reference path='../../../interfaces/firefox.d.ts' />

var port :ContentScriptPort;

class FirefoxBrowserAction implements BrowserAction {

  public setIcon = (iconFile :string) : void => {
    port.emit('setIcon', iconFile);
  }
}
