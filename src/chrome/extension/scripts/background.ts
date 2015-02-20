/**
 * background.ts
 *
 * This is the background page for the Extension. It maintains a chrome runtime
 * connection with the App, consistent state changes with the UI (see ui.js).
 */
// Assumes that core_stub.ts has been loaded.
// UserInterface is defined in 'generic_ui/scripts/ui.ts'.

/// <reference path='chrome_browser_api.ts' />
/// <reference path='chrome_core_connector.ts' />
/// <reference path='chrome_tab_auth.ts' />

/// <reference path='../../../interfaces/ui.d.ts' />
/// <reference path='../../../generic_ui/scripts/ui.ts' />
/// <reference path='../../../generic_ui/scripts/core_connector.ts' />

/// <reference path='../../../freedom/typings/social.d.ts' />
/// <reference path='../../../third_party/typings/chrome/chrome.d.ts'/>


var ui   :UI.UserInterface;  // singleton referenced in both options and popup.
// --------------------- Communicating with the App ----------------------------
var chromeCoreConnector :ChromeCoreConnector;  // way for ui to speak to a uProxy.CoreAPI
var core :CoreConnector;  // way for ui to speak to a uProxy.CoreAPI
var chromeBrowserApi :ChromeBrowserApi;
// Chrome Window ID of the window used to launch uProxy,
// i.e. the window where the extension icon was clicked
// or the window where the user is completing the install flow.
var mainWindowId = chrome.windows.WINDOW_ID_CURRENT;

chrome.runtime.onSuspend.addListener(() => {
  console.log('onSuspend');
  //proxyConfig.stopUsingProxy();
});

chrome.runtime.onMessageExternal.addListener(
    function(request, sender, sendResponse) {
        // Reply to pings from the uproxy website that are checking if the
        // extension is installed.
        if (request) {
          sendResponse({message: "Extension installed."});
        }
        return true;
    });

// Launch the Chrome webstore page for the uProxy app,
// or activate the user's tab open to uproxy.org/chrome-install
function openDownloadAppPage() : void {
  chrome.windows.get(mainWindowId, {populate: true}, (windowThatLaunchedUproxy) => {
    if (windowThatLaunchedUproxy) {
      for (var i = 0; i < windowThatLaunchedUproxy.tabs.length; i++) {
        // If the user is installing via the inline install flow,
        // instead of sending them to the webstore to install the app,
        // bring them back to uproxy.org/chrome-install
        if ((windowThatLaunchedUproxy.tabs[i].url.indexOf("uproxysite.appspot.com/chrome-install") > -1) ||
            (windowThatLaunchedUproxy.tabs[i].url.indexOf("uproxy.org/chrome-install") > -1)) {
          chrome.tabs.update(windowThatLaunchedUproxy.tabs[i].id, {active:true});
          chrome.windows.update(mainWindowId, {focused: true});
          return;
        }
      }
    }
    // Only reached if the user didn't have uproxy.org/chrome-install open,
    // allowing us to assume the user is completeing the webstore install flow.
    // For consistency, we direct them to the app download page in the webstore
    // instead of uproxy.org.
    chrome.tabs.create(
        {url: 'https://chrome.google.com/webstore/detail/uproxyapp/fmdppkkepalnkeommjadgbhiohihdhii'},
        (tab) => {
          // Focus on the new Chrome Webstore tab.
          chrome.windows.update(tab.windowId, {focused: true});
        });
    // After the app is installed via the webstore, open up uProxy.
    chromeCoreConnector.onceConnected.then(chromeBrowserApi.bringUproxyToFront);
  });
}

/**
 * Primary initialization of the Chrome Extension. Installs hooks so that
 * updates from the Chrome App side propogate to the UI.
 */
function initUI() : UI.UserInterface {
  chromeBrowserApi = new ChromeBrowserApi();
  // TODO (lucyhe): Make sure that the "install" event isn't missed if we
  // are adding the listener after the event is fired.
  chrome.runtime.onInstalled.addListener(() => {
    chrome.tabs.query({currentWindow: true, active: true}, function(tabs){
        // Do not open the extension when it's installed if the user is
        // going through the inline install flow.
        if ((tabs[0].url.indexOf("uproxysite.appspot.com/chrome-install") == -1) &&
            (tabs[0].url.indexOf("uproxy.org/chrome-install") == -1)) {
          chromeBrowserApi.bringUproxyToFront();
        }
    });
  });
  chrome.browserAction.onClicked.addListener((tab) => {
    // When the extension icon is clicked, open uProxy.
    mainWindowId = tab.windowId;
    chromeBrowserApi.bringUproxyToFront();
  });

  chromeCoreConnector = new ChromeCoreConnector({ name: 'uproxy-extension-to-app-port' });
  chromeCoreConnector.onUpdate(uProxy.Update.LAUNCH_UPROXY,
                           chromeBrowserApi.bringUproxyToFront);
  chromeCoreConnector.connect();

  core = new CoreConnector(chromeCoreConnector);
  var oAuth = new ChromeTabAuth();
  chromeCoreConnector.onUpdate(uProxy.Update.GET_CREDENTIALS,
                           oAuth.login.bind(oAuth));

  // used for de-duplicating urls caught by the listeners
  var lastUrl = '';

  chrome.webRequest.onBeforeRequest.addListener(
    function() {
      return {cancel: true};
    },
    {urls: ['https://www.uproxy.org/oauth-redirect-uri*']},
    ['blocking']
  );

  chrome.webRequest.onBeforeRequest.addListener(
    function(details) {
      var url = details.url;

      // Chome seems to sometimes send the same url to us twice, we never
      // should be receiving the exact same data twice so de-dupe any url
      // with the last one we received before processing it
      if (lastUrl !== url) {
        ui.handleUrlData(url);
      } else {
        console.warn('Received duplicate url events', url);
      }
      lastUrl = url;

      return {
        redirectUrl: chrome.extension.getURL('index.html')
      };
    },
    { urls: ['https://www.uproxy.org/request/*', 'https://www.uproxy.org/offer/*'] },
    ['blocking']
  );

  return new UI.UserInterface(core, chromeBrowserApi);
}

console.log('Initializing chrome extension background page...');
if (undefined === ui) {
  ui = initUI();
}
