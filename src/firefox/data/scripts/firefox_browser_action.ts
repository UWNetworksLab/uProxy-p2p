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

  public setLabel = (text :string) : void => {
    // This is not used and not clear what it should be doing.
    // TODO: figure out wether we need it or not.
  }

  public setColor = (color :string) : void=> {
    // This is not used and not clear what it should be doing.
  }

}
