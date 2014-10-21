/**
 * background.ts
 *
 * This is the background page for the Extension. It maintains a chrome runtime
 * connection with the App, consistent state changes with the UI (see ui.js)
 * and holds the data model for both the popup and options page.
 */
// Assumes that core_stub.ts has been loaded.
// UserInterface is defined in 'generic_ui/scripts/ui.ts'.

/// <reference path='chrome_browser_action.ts' />
/// <reference path='chrome_connector.ts' />
/// <reference path='google_auth.ts' />
/// <reference path='oauth.ts' />
/// <reference path='proxy-config.ts' />

/// <reference path='../../../interfaces/ui.d.ts' />
/// <reference path='../../../generic_ui/scripts/ui.ts' />
/// <reference path='../../../generic_ui/scripts/core_connector.ts' />

/// <reference path='../../../freedom/typings/social.d.ts' />
/// <reference path='../../../third_party/typings/chrome/chrome.d.ts'/>


var ui   :UI.UserInterface;  // singleton referenced in both options and popup.
// --------------------- Communicating with the App ----------------------------
var chromeConnector :ChromeConnector;  // way for ui to speak to a uProxy.CoreAPI
var core :CoreConnector;  // way for ui to speak to a uProxy.CoreAPI

// TODO: This should be *actually* typed.
// Proxy Configuration.
var proxyConfig = <IBrowserProxyConfig>new BrowserProxyConfig();


// Singleton model for data bindings.
var model :UI.Model = {
  networks: [],
  contacts: {
    'onlineTrustedUproxy': [],
    'offlineTrustedUproxy': [],
    'onlineUntrustedUproxy': [],
    'offlineUntrustedUproxy': [],
    'onlineNonUproxy': [],
    'offlineNonUproxy': []
  },
  description: ''
};

// TODO(): remove this if there's no use for it.
chrome.runtime.onInstalled.addListener((details) => {
  console.log('onInstalled: previousVersion', details.previousVersion);
});

chrome.runtime.onSuspend.addListener(() => {
  console.log('onSuspend');
  //proxyConfig.stopUsingProxy();
});

/**
 * Primary initialization of the Chrome Extension. Installs hooks so that
 * updates from the Chrome App side propogate to the UI.
 */
function initUI() : UI.UserInterface {

  chromeConnector = new ChromeConnector({ name: 'uproxy-extension-to-app-port' });
  chromeConnector.connect();

  core = new CoreConnector(chromeConnector);
  var browserAction = new ChromeBrowserAction();
  var oAuth = new OAuth();
  chromeConnector.onUpdate(uProxy.Update.GET_CREDENTIALS, oAuth.getCredentials);

  return new UI.UserInterface(core, browserAction);
}

console.log('Initializing chrome extension background page...');
if (undefined === ui) {
  ui = initUI();
}
