/**
 * notify.ts
 *
 * This is the Chrome-specific implementation of the Notifications API.
 */
/// <reference path='../../../interfaces/notify.d.ts' />
/// <reference path='../../../interfaces/lib/chrome/chrome.d.ts'/>

class ChromeBrowserAction implements BrowserAction {
  public ICON_DIR :string = 'icons/';

  public setIcon = (iconFile :string) : void => {
    chrome.browserAction.setIcon({
      path: this.ICON_DIR + iconFile
    });
  }

  public setLabel = (text :string) : void => {
    chrome.browserAction.setBadgeText({ text: '' + text });
  }

  public setColor = (color :string) : void=> {
    chrome.browserAction.setBadgeBackgroundColor({color: color});
  }
}
