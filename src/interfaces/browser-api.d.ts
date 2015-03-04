// Describes the interface for functions that have different implications
// for different browsers.

interface BrowserAPI {
  // Configuration and control of the browsers proxy settings.
  startUsingProxy(endpoint:Net.Endpoint) : void;
  stopUsingProxy(askUser:boolean) : void;
  // Set the browser icon for the extension/add-on.
  setIcon(iconFile :string) : void;
  // Open a new tab with the uProxy FAQ.
  openFaq(pageAnchor :string) : void;
  bringUproxyToFront() : void;
  browserSpecificElement : string;
  showNotification(notificationTest :string) :void;
}

declare var Notification : {
  new (title :string, options ?:any) : any;
}
