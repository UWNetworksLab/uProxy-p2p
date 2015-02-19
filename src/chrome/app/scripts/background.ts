/**
 * background.ts
 *
 * This file must be included *after* the freedom script and manifest are
 * loaded.
 */
/// <reference path='chrome_oauth.ts' />
/// <reference path='chrome_ui_connector.ts' />
/// <reference path='../../../uproxy.ts' />
/// <reference path='../../../freedom/typings/freedom.d.ts' />
/// <reference path='../../../third_party/typings/chrome/chrome-app.d.ts'/>

// Remember which handlers freedom has installed.
var connector :ChromeUIConnector;
var uProxyAppChannel : OnAndEmit<any,any>;

var uproxyModule = new freedom('scripts/freedom-module.json', {
  'logger': 'scripts/uproxy-lib/loggingprovider/loggingprovider.json',
  'debug': 'debug',
  oauth: [Chrome_oauth]
}).then(function(UProxy : () => void) {
  uProxyAppChannel = new UProxy();
  connector = new ChromeUIConnector();
  console.log('Starting uProxy app...');
});

// Reply to pings from the uproxy website that are checking if the
// application is installed.
chrome.runtime.onMessageExternal.addListener(
    function(request, sender, sendResponse) {
        if (request) {
          sendResponse({message: "Application installed."});
        }
        return true;
    });
