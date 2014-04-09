/**
 * notify.ts
 *
 * This is the Chrome-specific implementation of the Notifications API.
 */
/// <reference path='../../../interfaces/notify.d.ts' />

class ChromeNotifications implements INotifications {
  ICON_DIR:string = 'icons/';
  setIcon(iconFile : string) {
    // TODO: make this not require chrome
    chrome.browserAction.setIcon({
      path: this.ICON_DIR + iconFile
    });
  }
  setLabel(text : string) {
    chrome.browserAction.setBadgeText({ text: '' + text });
  }
  setColor(color) {
    chrome.browserAction.setBadgeBackgroundColor({color: color});
  }
}
