/**
 * background.ts
 *
 * This is the background page for the Extension. It maintains a chrome runtime
 * connection with the App, consistent state changes with the UI (see ui.js).
 */
// Assumes that core_stub.ts has been loaded.
// UserInterface is defined in 'generic_ui/scripts/ui.ts'.

import ChromeBrowserApi = require('./chrome_browser_api');
import ChromeCoreConnector = require('./chrome_core_connector');
import ChromeTabAuth = require('./chrome_tab_auth');

import UiApi = require('../../../interfaces/ui');
import user_interface = require('../../../generic_ui/scripts/ui');
import CoreConnector = require('../../../generic_ui/scripts/core_connector');
import uproxy_core_api = require('../../../interfaces/uproxy_core_api');

/// <reference path='../../../freedom/typings/social.d.ts' />
/// <reference path='../../../third_party/typings/chrome/chrome.d.ts'/>

export import model = user_interface.model;

export var ui   :user_interface.UserInterface;  // singleton referenced in both options and popup.
// --------------------- Communicating with the App ----------------------------
export var chromeCoreConnector :ChromeCoreConnector;  // way for ui to speak to a uProxy.CoreApi
export var core :CoreConnector;  // way for ui to speak to a uProxy.CoreApi
var chromeBrowserApi :ChromeBrowserApi;
// Chrome Window ID of the window used to launch uProxy,
// i.e. the window where the extension icon was clicked
// or the window where the user is completing the install flow.
chrome.runtime.onSuspend.addListener(() => {
  console.log('onSuspend');
  //proxyConfig.stopUsingProxy();
});

chrome.runtime.onMessage.addListener((request :any, sendResponse :Function) => {
  // handle requests from other pages (i.e. copypaste.html) to bring the
  // chrome popup to the front
  if (request && request.openWindow) {
    chromeBrowserApi.bringUproxyToFront();
  }

  // handle requests to stop proxying
  if (request && request.stopProxying) {
    ui.stopGettingInUiAndConfig(false);
  }

  // handle requests to get logs
  if (request && request.getLogs) {
    core.getLogs().then((logs) => {
      sendResponse({ logs: logs });
    });
    return true;
  }
});

chrome.runtime.onMessageExternal.addListener((request :any, sender :chrome.runtime.MessageSender, sendResponse :Function) => {
  // Reply to pings from the uproxy website that are checking if the
  // extension is installed.
  if (request) {
    sendResponse({ message: 'Extension installed.' });
  }
  return true;
});

/**
 * Primary initialization of the Chrome Extension. Installs hooks so that
 * updates from the Chrome App side propogate to the UI.
 */
function initUI() : user_interface.UserInterface {
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
    chromeBrowserApi.bringUproxyToFront();
  });

  chromeCoreConnector = new ChromeCoreConnector({ name: 'uproxy-extension-to-app-port' });
  chromeCoreConnector.onUpdate(uproxy_core_api.Update.LAUNCH_UPROXY,
                           chromeBrowserApi.bringUproxyToFront);
  chromeCoreConnector.connect();

  core = new CoreConnector(chromeCoreConnector);
  var oAuth = new ChromeTabAuth();
  chromeCoreConnector.onUpdate(uproxy_core_api.Update.GET_CREDENTIALS,
                           oAuth.login.bind(oAuth));

  // used for de-duplicating urls caught by the listeners
  var lastUrl = '';
  var lastUrlTime = 0;

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
      // with the last one we received before processing it.  We also want
      // to allow a url to be pasted twice if there has been at least a second
      // delay in order to allow users to try connecting again.
      if (lastUrl !== url || Date.now() - lastUrlTime > 1000) {
        chromeBrowserApi.trigger('urlData', url);
      } else {
        console.warn('Received duplicate url events', url);
      }
      lastUrl = url;
      lastUrlTime = Date.now();

      return {
        redirectUrl: chrome.extension.getURL('copypaste.html')
      };
    },
    { urls: ['https://www.uproxy.org/request/*', 'https://www.uproxy.org/offer/*'] },
    ['blocking']
  );

  return new user_interface.UserInterface(core, chromeBrowserApi);
}

console.log('Initializing chrome extension background page...');
if (undefined === ui) {
  ui = initUI();
}
