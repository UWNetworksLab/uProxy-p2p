/**
 * background.ts
 *
 * This is the background page for the Extension. It maintains a chrome runtime
 * connection with the App, consistent state changes with the UI (see ui.js)
 * and holds the data model for both the popup and options page.
 */
// Assumes that core_stub.ts has been loaded.

/// <reference path='core_stub.ts' />
/// <reference path='../../interfaces/core.d.ts' />
/// <reference path='../../generic_ui/scripts/ui.ts' />
/// <reference path='../../../third_party/DefinitelyTyped/chrome/chrome.d.ts' />
/// <reference path='../../interfaces/commands.d.ts' />

console.log('Initializing chrome extension background page...');

declare var jsonpatch:any;

// This singleton is referenced in both options and popup.
// UserInterface is defined in 'generic_ui/scripts/ui.ts'.
if (undefined === ui) {
  var core = new ChromeAppConnector({ name: 'uproxy-extension-to-app-port' });
  var ui = new UI.UserInterface(new ChromeNotifications(), core);
  core.setConnectionHandler(init);
}

// --------------------- Communicating with the App ----------------------------

var _extensionInitialized = false;

// TODO: This should be *actually* typed.
// Proxy Configuration.
var proxyConfig = new window['BrowserProxyConfig']();
proxyConfig.clearConfig();

// ---------------------------- State Changes ----------------------------------
var model :any = {};  // Singleton angularjs model for either popup or options.
var onStateChange = new chrome.Event();

// Rate Limiting for state updates (ms)
var syncBlocked = false;
var syncTimer = null;     // Keep reference to the timer.

// Rate limit synchronizations.
function rateLimitedUpdates() {
  ui.sync();
  checkRunningProxy();
  onStateChange.dispatch();
}

// TODO(): remove this if there's no use for it.
chrome.runtime.onInstalled.addListener(function (details) {
  console.log('onInstalled: previousVersion', details.previousVersion);
});

chrome.runtime.onSuspend.addListener(function () {
  console.log('onSuspend');
  //proxyConfig.stopUsingProxy();
})


// ---------------------------- Initialization ---------------------------------
/**
 * Called when appChannel is connected.
 */
function init(appChannel) {

  var finishStateChange = function() {
    // Initiate first sync and start a timer if necessary, in order to
    // rate-limit passes through the entire model & other checks.
    if (!syncBlocked) {
      syncBlocked = true;
      rateLimitedUpdates();
    }
    if (!syncTimer) {
      syncTimer = setTimeout(function() {
        rateLimitedUpdates();
        syncTimer = null;  // Allow future timers.
        syncBlocked = false;
      }, SYNC_TIMEOUT);
    }
  }

  // A full state-refresh should occur whenever the extension first connects to
  // the App, or when the user does a full reset.
  appChannel.on('state-refresh', (state) => {
    // For resetting state, don't nuke |model| with the new object...
    // (there are references to it for Angular) instead, replace keys so the
    // angular $watch can catch up.
    for (var k in model) {
      delete model[k];
    }
    for (var k in state) {
      model[k] = state[k];
    }
    console.log('state-refresh: model = ', model);
    finishStateChange();
  });

  // Normal state-changes should modify some path inside |model|.
  appChannel.on('state-change', (patchMsg) => {
    console.log('state-change(patch: ', patchMsg);
    for (var i in patchMsg) {
      // NEEDS TO BE ADD, BECAUSE THIS IS A HACK :)
      // TODO: kill jsonpatch
      patchMsg[i].op = 'add';
      if ('' == patchMsg[i].path) {
        console.log('WARNING: There should never be a root state-change. \n' +
                    'Use state-refresh');
      }
    }
    jsonpatch.apply(model, patchMsg);
    finishStateChange();
  });

  console.log('UI <------> APP wired.');
  appChannel.sendToApp('ui-ready');  // Tell uproxy.js to send us a state-refresh.
}


function checkRunningProxy() {
  if (model && 'instances' in model) {
    for (var k in model['instances']) {
      if (model['instances'].hasOwnProperty(k) && model['instances'][k].status &&
          model['instances'][k].status.proxy) {
        if ('running' == model['instances'][k].status.proxy) {
          proxyConfig.startUsingProxy();
          return;
        }
      }
    }
  }
  proxyConfig.stopUsingProxy();
}
