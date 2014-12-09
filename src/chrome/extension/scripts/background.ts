/**
 * background.ts
 *
 * This is the background page for the Extension. It maintains a chrome runtime
 * connection with the App, consistent state changes with the UI (see ui.js)
 * and holds the data model for both the popup and options page.
 */
// Assumes that core_stub.ts has been loaded.
// UserInterface is defined in 'generic_ui/scripts/ui.ts'.

/// <reference path='chrome_browser_api.ts' />
/// <reference path='chrome_connector.ts' />
/// <reference path='google_auth.ts' />
/// <reference path='oauth.ts' />

/// <reference path='../../../interfaces/ui.d.ts' />
/// <reference path='../../../generic_ui/scripts/ui.ts' />
/// <reference path='../../../generic_ui/scripts/core_connector.ts' />

/// <reference path='../../../freedom/typings/social.d.ts' />
/// <reference path='../../../third_party/typings/chrome/chrome.d.ts'/>


var ui   :UI.UserInterface;  // singleton referenced in both options and popup.
// --------------------- Communicating with the App ----------------------------
var chromeConnector :ChromeConnector;  // way for ui to speak to a uProxy.CoreAPI
var core :CoreConnector;  // way for ui to speak to a uProxy.CoreAPI


// Singleton model for data bindings.
var model :UI.Model = {
  networks: [],
  contacts: {
    'getAccessContacts' : {
      'onlinePending': [],
      'offlinePending': [],
      'onlineTrustedUproxy': [],
      'offlineTrustedUproxy': [],
      'onlineUntrustedUproxy': [],
      'offlineUntrustedUproxy': [],
      'onlineNonUproxy': [],
      'offlineNonUproxy': []
    },
    'shareAccessContacts' : {
      'onlinePending': [],
      'offlinePending': [],
      'onlineTrustedUproxy': [],
      'offlineTrustedUproxy': [],
      'onlineUntrustedUproxy': [],
      'offlineUntrustedUproxy': [],
      'onlineNonUproxy': [],
      'offlineNonUproxy': []
    }
  },
  globalSettings : {
    'description' : '',
    'stunServers' : []
  }
};

// Chrome Window ID given to the uProxy popup.
var popupWindowId = -1;
// The URL to launch when the user clicks on the extension icon.
var popupUrl = "polymer/install-incomplete.html";
// Chrome Window ID of the window used to launch uProxy,
// i.e. the window where the extension icon was clicked.
var mainWindowId = -1;

// TODO(): remove this if there's no use for it.
chrome.runtime.onInstalled.addListener((details) => {
  console.log('onInstalled: previousVersion', details.previousVersion);
});

chrome.runtime.onSuspend.addListener(() => {
  console.log('onSuspend');
  //proxyConfig.stopUsingProxy();
});

/**
  * Set the URL launched by clicking the browser icon.
  */
function setPopupUrl(url) : void {
  popupUrl = url;
  // If an existing popup exists, close it because the popup URL has changed.
  // The next time the user clicks on the browser icon, a new page should be
  // launched.
  if (popupWindowId != -1) {
    chrome.windows.remove(popupWindowId);
    popupWindowId == -1;
  }
}

/**
 * Primary initialization of the Chrome Extension. Installs hooks so that
 * updates from the Chrome App side propogate to the UI.
 */
function initUI() : UI.UserInterface {
  var chromeBrowserApi = new ChromeBrowserApi();
  chrome.browserAction.onClicked
    .addListener(chromeBrowserApi.bringUproxyToFront);

  chromeConnector = new ChromeConnector({ name: 'uproxy-extension-to-app-port' });
  chromeConnector.connect();

  core = new CoreConnector(chromeConnector);
  var oAuth = new OAuth();
  chromeConnector.onUpdate(uProxy.Update.GET_CREDENTIALS,
                           oAuth.getCredentials.bind(oAuth));

  chrome.webRequest.onBeforeRequest.addListener(
    function() {
      return {cancel: true};
    },
    {urls: [REDIRECT_URL + "*"]},
    ['blocking']
  );

  return new UI.UserInterface(core, chromeBrowserApi);
}

console.log('Initializing chrome extension background page...');
if (undefined === ui) {
  ui = initUI();
}
