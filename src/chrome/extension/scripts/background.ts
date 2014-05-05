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

  // TODO: Move these attachments into ui.ts

  // Attach handlers for UPDATES received from core.
  core.onUpdate(uProxy.Update.ALL, (state :Object) => { 
    console.log('Received uProxy.Update.ALL:', state);
    // TODO: Implement this after a better payload message is implemented.
    // There is now a difference between the UI Model and the state object
    // from the core, so one-to-one mappinsg from the old json-patch code cannot
    // work.
    finishStateChange();
  });

  // Add or update the online status of a network.
  core.onUpdate(uProxy.Update.NETWORK, (network :UI.NetworkMessage) => {
    console.log('uProxy.Update.NETWORK', network, model.networks);
    console.log(model);
    if (!(network.name in model.networks)) {
      // TODO: Turn this into a class.
      model.networks[network.name] = {
        name:   network.name,
        online: network.online,
        roster: {}
      };
    } else {
      model.networks[network.name].online = network.online;
    }
  });

  // TODO: Implement the rest of the fine-grained state updates.
  // (We begin with the simplest, total state update, above.)

  // TODO: factor into the UI class.
  function updateUser(payload :UI.UserMessage) {
    var network = model.networks[payload.network];
    if (!network) {
      console.warn('Received USER for non-existing network.');
      return;
    }
    // Construct a UI-specific user object.
    var profile = payload.user;
    // Insert the user both in the network-specific roster and the global
    // roster.
    var user :UI.User;
    if (!(profile.userId in network.roster)) {
      user = {
        name:            profile.name,
        userId:          profile.userId,
        url:             profile.url,
        imageData:       profile.imageDataUri,
        online:          false,
        canUProxy:       false,
        givesMe:         false,
        usesMe:          false,
        hasNotification: false,
        clients:         {}
      }
      network.roster[profile.userId] = user;
      model.roster[profile.userId] = user;
    } else {
      user = network.roster[profile.userId];
      user.name = profile.name;
      user.url = profile.url;
      user.imageData = profile.imageDataUri;
    }
    var statuses = payload.clients;
    // Is online if there is at least one client that is not 'OFFLINE'.
    user.online = statuses.some((status) => {
      return UProxyClient.Status.OFFLINE !== status;
    });
    // Has uProxy if there is at least one client that is 'ONLINE'.
    user.canUProxy = statuses.some((status) => {
      return UProxyClient.Status.ONLINE === status;
    });
    console.log('Updated ' + user.name + ' - known to be: ' +
                '\n online: ' + user.online +
                '\n uproxy-enabled: ' + user.canUProxy);
  };

  // Attach handlers for USER updates.
  core.onUpdate(uProxy.Update.USER_SELF, (payload :UI.UserMessage) => {
    console.log('uProxy.Update.USER_SELF:', payload);
    // Instead of adding to the roster, update the local user information.
  });
  core.onUpdate(uProxy.Update.USER_FRIEND, (payload :UI.UserMessage) => {
    console.log('uProxy.Update.USER_FRIEND:', payload);
    updateUser(payload);
  });

  // core.onUpdate(uProxy.Update.CLIENT, (payload :UI.ClientMessage) => {
    // console.log('uProxy.Update.CLIENT:', payload);
    // updateClient(payload);
  // });

  return new UI.UserInterface(core, notifications);
}

console.log('Initializing chrome extension background page...');
if (undefined === ui) {
  ui = initUI();
}
