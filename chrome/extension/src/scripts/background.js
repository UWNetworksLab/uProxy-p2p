// Assumes that freedom_connector.js has been loaded.
'use strict';
/* jshint -W098 */

console.log('Initializing chrome extension background page...');

// Chrome App Id for UProxy Packaged Chrome App.
var FREEDOM_CHROME_APP_ID = 'hilnpmepiebcjhibkbkfkjkacnnclkmi';
// Rate Limit for UI.synchronize (ms)
var SYNC_TIMEOUT = 500;
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
    //console.log("state-change(patch: ", patchMsg);
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

    /*
    // Run through roster if necessary.
    if (patch[0].path.indexOf('roster') >= 0) {
      // - Ensure it's sorted alphabetically.
      console.log('roster edit. ' + patch[0].path);
      // - Count up notifications.
      $rootScope.notifications = 0;
      // var sortedIds = Object.keys(model.roster);
      // console.log(sortedIds);
      // sortedIds.sort();
      // var sortedRoster = {};
      var rosterByName = {};
      for (var userId in model.roster) {
        // sortedRoster[userId] = model.roster[userId];
        var user = model.roster[userId];
        roster.updateContact(user);
        $rootScope.notifications += user.hasNotification? 1 : 0;
        // rosterByName[user.name] = user;
      }
      // var sortedNames = Object.keys(rosterByName);
      // console.log(sortedNames);
      // var sortedRoster = {};
      // sortedNames.sort();
      // for (var name in sortedNames) {
        // sortedRoster[name] = rosterByName[name];
      // }
      // $rootScope.roster = sortedRoster;
      if ($rootScope.notifications > 0) {
        icon.label('' + $rootScope.notifications);
      }
      $rootScope.roster = roster;
    }
    */

    // This event allows angular to bind listeners and update the DOM.
  });
  console.log('Wiring UI to backend done.');
}

function checkRunningProxy() {
  if (model && model.instances) {
    for (var k in model.instances) {
      if (model.instances.hasOwnProperty(k) && model.instances[k].status &&
          model.instances[k].status.proxy) {
        if (model.instances[k].status.proxy == 'running') {
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
  setTimeout(checkThatAppIsInstalled, new Date() + (SYNC_TIMEOUT * 2));
}

// Attach state-change listener to update UI from the backend.
appChannel.onConnected.addListener(initialize);

checkThatAppIsInstalled();
