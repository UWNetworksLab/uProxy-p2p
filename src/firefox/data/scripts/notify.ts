/**
 * notify.ts
 *
 * This is the Firefox-specific implementation of the Notifications API.
 */
/// <reference path='../../../interfaces/notify.d.ts' />

class FirefoxNotifications implements INotifications {
  public ICON_DIR :string = 'icons/';

  public setIcon = (iconFile :string) : void => {
  }

  public setLabel = (text :string) : void => {
  }

  public setColor = (color :string) : void=> {
  }

  public showDesktopNotification = (notificationText :string) : void => {
  }

}
