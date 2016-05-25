// See https://github.com/Initsogar/cordova-webintent

interface WebIntent {
  getUri(callback:(url:string) => any) : void;
  onNewIntent(callback:(url:string) => any) : void;
}

interface Window {
  webintent: WebIntent;
}
