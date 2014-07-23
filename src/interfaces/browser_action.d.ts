// Describes the interface for notification settings. Implementations will be
// browser specific.

interface BrowserAction {
  setIcon(iconFile :string) : void;
  setLabel(text :string) : void;
  setColor(color :string) : void;
}

declare var Notification : {
  new (title :string, options ?:any) : any;
}


