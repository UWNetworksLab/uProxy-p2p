/**
 * background.ts
 *
 * This is the background page for the Extension. It maintains a chrome runtime
 * connection with the App, consistent state changes with the UI (see ui.js)
 * and holds the data model for both the popup and options page.
 */
// Assumes that core_stub.ts has been loaded.

/// <reference path='core_connector.ts' />
/// <reference path='proxy-config.ts' />

/// <reference path='../../../interfaces/lib/chrome/chrome.d.ts'/>
/// <reference path='../../../generic_ui/scripts/ui.ts' />

var ui   :uProxy.UIAPI;  // singleton referenced in both options and popup.
// --------------------- Communicating with the App ----------------------------
var core :ChromeCoreConnector;  // way for ui to speak to a uProxy.CoreAPI

// TODO: This should be *actually* typed.
// Proxy Configuration.
var proxyConfig = new BrowserProxyConfig();
proxyConfig.clearConfig();


// ---------------------------- State Changes ----------------------------------
// TODO: Type the model.
var model :any = {};  // Singleton angularjs model for either popup or options.
var onStateChange = new chrome.Event();

// Rate Limiting for state updates (ms)
var syncBlocked = false;
var syncTimer = null;     // Keep reference to the timer.

// TODO(): remove this if there's no use for it.
chrome.runtime.onInstalled.addListener((details) => {
  console.log('onInstalled: previousVersion', details.previousVersion);
});

chrome.runtime.onSuspend.addListener(() => {
  console.log('onSuspend');
  //proxyConfig.stopUsingProxy();
});


// Rate limit synchronizations.
function rateLimitedUpdates() {
  ui.sync();
  checkRunningProxy();
  onStateChange.dispatch();
}


// TODO: Implement this as part of the angular services (don't exist yet).
var finishStateChange = () => {
  // Initiate first sync and start a timer if necessary, in order to
  // rate-limit passes through the entire model & other checks.
  if (!syncBlocked) {
    syncBlocked = true;
    rateLimitedUpdates();
  }
  if (!syncTimer) {
    syncTimer = setTimeout(() => {
      rateLimitedUpdates();
      syncTimer = null;  // Allow future timers.
      syncBlocked = false;
    }, 5000);
  }
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


// UserInterface is defined in 'generic_ui/scripts/ui.ts'.
/**
 * Primary initialization of the Chrome Extension. Installs hooks so that
 * updates from the Chrome App side propogate to the UI.
 */
function initUI() : UI.UserInterface {

  core = new ChromeCoreConnector({ name: 'uproxy-extension-to-app-port' });
  core.connect();
  var notifications = new ChromeNotifications();

  // Attach handlers for UPDATES received from core.
  core.onUpdate(uProxy.Update.ALL, (state :Object) => {
    console.log('Received uProxy.Update.ALL:', state);
    // For resetting state, don't nuke |model| with the new object...
    // (there are references to it for Angular) instead, replace keys so the
    // angular $watch can catch up.
    for (var k in model) {
      delete model[k];
    }
    for (var k in state) {
      model[k] = state[k];
    }
    console.log('model = ', model);
    finishStateChange();
  });

  // TODO: Implement the rest of the fine-grained state updates.
  // (We begin with the simplest, total state update, above.)

  return new UI.UserInterface(core, notifications);
}

console.log('Initializing chrome extension background page...');
if (undefined === ui) {
  ui = initUI();
}
