/**
 * notify.ts
 *
 * This is the Firefox-specific implementation of the Notifications API.
 */
/// <reference path='../../../interfaces/notify.d.ts' />
/// <reference path='../../../interfaces/firefox.d.ts' />

var port :ContentScriptPort;

class FirefoxNotifications implements INotifications {

  public setIcon = (iconFile :string) : void => {
  }

  public setLabel = (text :string) : void => {
  }

  public setColor = (color :string) : void=> {
  }

  public showDesktopNotification = (notificationText :string) : void => {
    port.emit('showNotification', notificationText);
  }
}
