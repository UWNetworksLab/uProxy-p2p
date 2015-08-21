/**
 * background.ts
 *
 * This is the background page for the Extension. It maintains a chrome runtime
 * connection with the App, consistent state changes with the UI (see ui.js).
 */
// Assumes that core_stub.ts has been loaded.
// UserInterface is defined in 'generic_ui/scripts/ui.ts'.

/// <reference path='../../../../../third_party/typings/compare-version/compare-version.d.ts'/>

import ChromeBrowserApi = require('./chrome_browser_api');
import ChromeCoreConnector = require('./chrome_core_connector');
import ChromeTabAuth = require('./chrome_tab_auth');

import UiApi = require('../../../interfaces/ui');
import user_interface = require('../../../generic_ui/scripts/ui');
import CoreConnector = require('../../../generic_ui/scripts/core_connector');
import uproxy_core_api = require('../../../interfaces/uproxy_core_api');
import Constants = require('../../../generic_ui/scripts/constants');
import compareVersion = require('compare-version');

/// <reference path='../../../freedom/typings/social.d.ts' />
/// <reference path='../../../third_party/typings/chrome/chrome.d.ts'/>

// --------------------- Communicating with the App ----------------------------
export var browserConnector :ChromeCoreConnector;  // way for ui to speak to a uProxy.CoreApi
export var core :CoreConnector;  // way for ui to speak to a uProxy.CoreApi
export var browserApi :ChromeBrowserApi;
// Chrome Window ID of the window used to launch uProxy,
// i.e. the window where the extension icon was clicked
// or the window where the user is completing the install flow.
chrome.runtime.onSuspend.addListener(() => {
  console.log('onSuspend');
  //proxyConfig.stopUsingProxy();
});

chrome.runtime.onMessage.addListener((request :any, sender: chrome.runtime.MessageSender, sendResponse :Function) => {
  // handle requests from other pages (i.e. copypaste.html) to bring the
  // chrome popup to the front
  if (request && request.openWindow) {
    browserApi.bringUproxyToFront();
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

chrome.runtime.onUpdateAvailable.addListener((details) => {
  console.log('Update available');

  core.getVersion().then(function(versions) {
    if (compareVersion(details.version, versions.version) > 0) {
      // Only update if the new version is the same as or older than the app
      // version.  If we are not able to update now, this will be taken care of
      // by restarting at the same time as the core update.
      return;
    }

    chrome.proxy.settings.get({}, (details) => {
      if (details.levelOfControl === 'controlled_by_this_extension') {
        return;
      }

      // At this point, the core supports the update and we are not currently
      // proxying, let's do the update!
      chrome.runtime.reload();
    });
  });
});

/**
 * Primary initialization of the Chrome Extension. Installs hooks so that
 * updates from the Chrome App side propogate to the UI.
 */
browserApi = new ChromeBrowserApi();
browserConnector = new ChromeCoreConnector({ name: 'uproxy-extension-to-app-port' });
browserConnector.onUpdate(uproxy_core_api.Update.LAUNCH_UPROXY,
                          browserApi.bringUproxyToFront);

// TODO (lucyhe): Make sure that the "install" event isn't missed if we
// are adding the listener after the event is fired.
chrome.runtime.onInstalled.addListener((details :chrome.runtime.InstalledDetails) => {
  if (details.reason !== 'install') {
    // we only want to launch the window on the first install
    return;
  }
  browserConnector.onceConnected.then(() => {
    chrome.browserAction.setIcon({
      path: {
        "19" : "icons/19_" + Constants.DEFAULT_ICON,
        "38" : "icons/38_" + Constants.DEFAULT_ICON,
      }
    });
  });

  chrome.tabs.query({currentWindow: true, active: true}, function(tabs){
      // Do not open the extension when it's installed if the user is
      // going through the inline install flow.
      if ((tabs[0].url.indexOf("uproxysite.appspot.com/chrome-install") == -1) &&
          (tabs[0].url.indexOf("uproxy.org/chrome-install") == -1)) {
        browserApi.bringUproxyToFront();
      }
  });
});
chrome.browserAction.onClicked.addListener((tab) => {
  // When the extension icon is clicked, open uProxy.
  browserApi.bringUproxyToFront();
});

core = new CoreConnector(browserConnector);
var oAuth = new ChromeTabAuth();
browserConnector.onUpdate(uproxy_core_api.Update.GET_CREDENTIALS,
                         oAuth.login.bind(oAuth));

// used for de-duplicating urls caught by the listeners
var lastUrl = '';
var lastUrlTime = 0;

chrome.webRequest.onBeforeRequest.addListener(
    function(details) {
      browserApi.emit('inviteUrlData', details.url);
      // TODO: does this need the same timing logic as copy/paste?
      // TODO: show something meaningful in the tab
      return {
          redirectUrl: chrome.extension.getURL('generic_ui/invite-received.html')
      };
    },
    // TODO: need to do this for Firefox too
    { urls: ['https://www.uproxy.org/invite/*'] },
    ['blocking']
    );

chrome.webRequest.onBeforeRequest.addListener(
    function() {
        return { cancel: true };
    },
    { urls: ['https://www.uproxy.org/oauth-redirect-uri*'] },
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
      browserApi.emit('copyPasteUrlData', url);
    } else {
      console.warn('Received duplicate url events', url);
    }
    lastUrl = url;
    lastUrlTime = Date.now();

    return {
      redirectUrl: chrome.extension.getURL('generic_ui/copypaste.html')
    };
  },
  { urls: ['https://www.uproxy.org/request/*', 'https://www.uproxy.org/offer/*'] },
  ['blocking']
);

