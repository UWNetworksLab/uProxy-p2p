/// <reference path="cordova.d.ts" />

// See https://github.com/apache/cordova-plugin-inappbrowser
declare module cordova.InAppBrowser {
  var open: (url:string, target:string, options?:string) => Object;
}
