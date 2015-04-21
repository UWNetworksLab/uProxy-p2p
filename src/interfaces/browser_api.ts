import net = require('../../../third_party/uproxy-networking/net/net.types');

// Describes the interface for functions that have different implications
// for different browsers.

export interface BrowserAPI {
  // Configuration and control of the browsers proxy settings.
  startUsingProxy(endpoint:net.Endpoint) :void;
  stopUsingProxy() :void;
  // Set the browser icon for the extension/add-on.
  setIcon(iconFile :string) :void;
  // Open a new tab if it is not already open
  launchTabIfNotOpen(url :string) :void;
  // Open a new tab
  openTab(url :string) :void;
  bringUproxyToFront() :void;
  // TODO: write comment to explain what browserSpecificElement is.
  browserSpecificElement :string;

  /*
   * tag is used to uniquely identify notifications.  If it is a json-encoded
   * object with information on the notification, it should be used to
   * determine how to handle clicks to the notification
   */
  showNotification(text :string, tag :string) :void;

  /*
   * Make a domain fronted POST request to cloudfrontDomain/cloudfrontPath.
   *
   * externalDomain is visible on the wire, and used to 'front' the request
   * to Cloudfront. externalDomain should end in a forward slash.
   * cloudfrontPath should not start with a leading forward slash.
   */
  frontedPost(data :any, externalDomain :string, cloudfrontDomain :string,
           cloudfrontPath ?:string) : Promise<void>;

  on(name :string, callback :Function) :void;
  on(name :'urlData', callback :(url :string) => void) :void;
  on(name :'notificationClicked', callback :(tag :string) => void) :void;
}
