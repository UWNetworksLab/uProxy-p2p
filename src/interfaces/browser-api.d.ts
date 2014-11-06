interface BrowserAPI {
  startUsingProxy(endpoint:Net.Endpoint) : void;
  stopUsingProxy(askUser:boolean) : void;
  setIcon(iconFile :string) : void;
  openFaq(pageAnchor :string) : void;
}

declare var Notification : {
  new (title :string, options ?:any) : any;
}
