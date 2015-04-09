// Describes the interface for functions that have different implications
// for different browsers.

export interface BrowserAPI {
  // Configuration and control of the browsers proxy settings.
  startUsingProxy(endpoint:Net.Endpoint) :void;
  stopUsingProxy() :void;
  // Set the browser icon for the extension/add-on.
  setIcon(iconFile :string) :void;
  // Open a new tab if it is not already open
  launchTabIfNotOpen(url :string) :void;
  // Open a new tab
  openTab(url :string) :void;
  bringUproxyToFront() :void;
  browserSpecificElement :string;

  /*
   * tag is used to uniquely identify notifications.  If it is a json-encoded
   * object with information on the notification, it should be used to
   * determine how to handle clicks to the notification
   */
  showNotification(text :string, tag :string) :void;
}
