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


chrome.runtime.onSuspend.addListener(() => {
  console.log('onSuspend');
  //proxyConfig.stopUsingProxy();
});

// Launch the Chrome webstore page for the uProxy app.
function openDownloadAppPage() : void {
  chrome.tabs.create(
      {url: 'https://chrome.google.com/webstore/detail/uproxyapp/fmdppkkepalnkeommjadgbhiohihdhii'},
      (tab) => {
        // Focus on the new Chrome Webstore tab.
        chrome.windows.update(tab.windowId, {focused: true});
      });
  chromeCoreConnector.waitingForAppInstall = true;
}

/**
 * Primary initialization of the Chrome Extension. Installs hooks so that
 * updates from the Chrome App side propogate to the UI.
 */
function initUI() : UI.UserInterface {
  chromeBrowserApi = new ChromeBrowserApi();
  // TODO (lucyhe): Make sure that the "install" event isn't missed if we
  // are adding the listener after the event is fired.
  chrome.runtime.onInstalled.addListener(chromeBrowserApi.bringUproxyToFront);

  chromeCoreConnector = new ChromeCoreConnector({ name: 'uproxy-extension-to-app-port' });
  chromeCoreConnector.onUpdate(uProxy.Update.LAUNCH_UPROXY,
                           chromeBrowserApi.bringUproxyToFront);
  chromeCoreConnector.connect();

  core = new CoreConnector(chromeCoreConnector);
  var oAuth = new ChromeTabAuth();
  chromeCoreConnector.onUpdate(uProxy.Update.GET_CREDENTIALS,
                           oAuth.login.bind(oAuth));

  chrome.webRequest.onBeforeRequest.addListener(
    function() {
      return {cancel: true};
    },
    {urls: ['https://www.uproxy.org/oauth-redirect-uri*']},
    ['blocking']
  );

  return new UI.UserInterface(core, chromeBrowserApi);
}

console.log('Initializing chrome extension background page...');
if (undefined === ui) {
  ui = initUI();
}
