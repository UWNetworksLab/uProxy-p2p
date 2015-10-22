interface Window {
    cordova: typeof cordova;
}

declare module cordova.InAppBrowser {
  var open: (url:string, target:string, options?:string) => Object;
}
