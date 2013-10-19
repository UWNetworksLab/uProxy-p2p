// Assumes that freedom_connector.js has been loaded.
'use strict';
/* jshint -W098 */

console.log('Initializing chrome extension background page...');

// Chrome App Id for UProxy Packaged Chrome App.
var FREEDOM_CHROME_APP_ID = 'hilnpmepiebcjhibkbkfkjkacnnclkmi';
// Rate Limit for UI.synchronize (ms)
var SYNC_TIMEOUT = 800;
var syncBlocked = false;
var syncTimer = null;     // Keep reference to the timer.

// Proxy Configuration.
var proxyConfig = new window.BrowserProxyConfig();
proxyConfig.clearConfig();

// TODO(): remove this if there's no use for it.
chrome.runtime.onInstalled.addListener(function (details) {
  console.log('onInstalled: previousVersion', details.previousVersion);
});

chrome.runtime.onSuspend.addListener(function () {
  console.log('onSuspend');
  //proxyConfig.stopUsingProxy();
})

var onStateChange = new chrome.Event();

var model = {};  // Singleton angularjs model for either popup or options.

// For maintaining a single roster with various sort methods.
var Roster = function() {
  this.all = [];
  this.updateContact = function(c) {
    if (all.indexOf(c) < 0)
      all.push(c);
  }
};
var roster = new Roster();

// This singleton is referenced in both options and popup.
// UI object is defined in 'common/ui/scripts/ui.js'.
var ui = new UI();

// Connect to the App.
var appChannel = new FreedomConnector(FREEDOM_CHROME_APP_ID, {
    name: 'uproxy-extension-to-app-port' });

// Rate limit synchronizations.
function rateLimitedUpdates() {
  ui.synchronize();
  checkRunningProxy();
  onStateChange.dispatch();
}

function initialize() {
  // ui-ready tells uproxy.js to send over *all* the state.
  appChannel.emit('ui-ready');
  console.log('Wiring UI to backend...');
  appChannel.on('state-change', function(patchMsg) {
    console.log("state-change(patch: ", patchMsg);
    // For resetting state, don't change model object (there are references to
    // it Angular, instead, replace keys, so the watch can catch up);
    // TODO: run the check below for each message?
    // TODO: fix JSON patch :)
    if (patchMsg[0].path === '') {
      for (var k in model) {
        delete model[k];
      }
      for (var k in patchMsg[0].value) {
        model[k] = patchMsg[0].value[k];
      }
    } else {
      // NEEDS TO BE ADD BECAUSE THIS IS A HACK :)
      for (var i in patchMsg) {
        patchMsg[i].op = 'add';
      }
      jsonpatch.apply(model, patchMsg);
    }
    console.log('model is now: ', model);

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

    // This event allows angular to bind listeners and update the DOM.
  });
  console.log('Wiring UI to backend done.');
}

function checkRunningProxy() {
  if (model && model.instances) {
    for (var k in model.instances) {
      if (model.instances.hasOwnProperty(k) && model.instances[k].status &&
          model.instances[k].status.proxy) {
        if ('running' == model.instances[k].status.proxy) {
          proxyConfig.startUsingProxy();
          return;
        }
      }
    }
  }
  proxyConfig.stopUsingProxy();
}

function checkThatAppIsInstalled() {
  appChannel.connect();
  setTimeout(checkThatAppIsInstalled, SYNC_TIMEOUT * 5);
}

// Attach state-change listener to update UI from the backend.
appChannel.onConnected.addListener(initialize);

checkThatAppIsInstalled();
