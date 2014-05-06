/**
 * background.ts
 *
 * This is the background page for the Extension. It maintains a chrome runtime
 * connection with the App, consistent state changes with the UI (see ui.js)
 * and holds the data model for both the popup and options page.
 */
// Assumes that core_stub.ts has been loaded.
// UserInterface is defined in 'generic_ui/scripts/ui.ts'.

/// <reference path='core_connector.ts' />
/// <reference path='proxy-config.ts' />

/// <reference path='../../../interfaces/ui.d.ts' />
/// <reference path='../../../interfaces/lib/chrome/chrome.d.ts'/>
/// <reference path='../../../generic_ui/scripts/ui.ts' />

/// <reference path='../../../../node_modules/freedom-typescript-api/interfaces/social.d.ts' />

var ui   :uProxy.UIAPI;  // singleton referenced in both options and popup.
// --------------------- Communicating with the App ----------------------------
var core :ChromeCoreConnector;  // way for ui to speak to a uProxy.CoreAPI

// TODO: This should be *actually* typed.
// Proxy Configuration.
var proxyConfig = new BrowserProxyConfig();
proxyConfig.clearConfig();


// Singleton model for angularjs hooks on both popup and options.
var model :UI.Model = {
  networks: {},
  // 'global' roster, which is just the concatenation of all network rosters.
  roster: {}
};

// ---------------------------- State Changes ----------------------------------
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

/**
 * Start proxying if one instance has their proxy status enabled.
 * Otherwise, stop all proxying.
 */
function checkRunningProxy() {
  // TODO: Make this work with the new UI model.
  // proxyConfig.startUsingProxy();
  proxyConfig.stopUsingProxy();
}


/**
 * Primary initialization of the Chrome Extension. Installs hooks so that
 * updates from the Chrome App side propogate to the UI.
 */
function initUI() : UI.UserInterface {

  core = new ChromeCoreConnector({ name: 'uproxy-extension-to-app-port' });
  core.connect();
  var notifications = new ChromeNotifications();

  return new UI.UserInterface(core, notifications);
}

console.log('Initializing chrome extension background page...');
if (undefined === ui) {
  ui = initUI();
}
