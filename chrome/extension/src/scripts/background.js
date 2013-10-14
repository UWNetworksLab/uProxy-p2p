// Assumes that freedom_connector.js has been loaded.
'use strict';
/* jshint -W098 */

console.log('Initializing chrome extension background page...');

// Chrome App Id for UProxy Packaged Chrome App.
var FREEDOM_CHROME_APP_ID = 'hilnpmepiebcjhibkbkfkjkacnnclkmi';

// TODO(): remove this if there's no use for it.
chrome.runtime.onInstalled.addListener(function (details) {
  console.log('onInstalled: previousVersion', details.previousVersion);
});

var onStateChange = new chrome.Event();

var model = {};  // Singleton angularjs model for either popup or options.

var Icon = function() {
  this.set = function(path) {
    // console.log('Setting browser icon to: ' + path);
    chrome.browserAction.setIcon({
      path: path
    });
  };
  this.label = function(text) {
    // console.log('Setting browser badge to: ' + text);
    chrome.browserAction.setBadgeText({
      text: text
    });
  };
};
var icon = new Icon();

// For maintaining a single roster with various sort methods.
var Roster = function() {
  this.all = [];
  this.updateContact = function(c) {
    if (all.indexOf(c) < 0)
      all.push(c);
  }
};
var roster = new Roster();

// User Interface state holder.
// TODO(uzimizu): move UI into its own file in common so firefox can use it.
var UI = function() {
  this.notifications = 0;
  // Keep track of currently viewed contact and instance.
  this.contact = null;
  this.instance = null;
  this.splashPage = !this.loggedIn();
  this.rosterNudge = false;
  this.advancedOptions = false;
};
UI.prototype.setNotifications = function(n) {
  if (n > 0) {
    icon.label('' + n);
  } else {
    icon.label('');
  }
  this.notificatiosn = n < 0? 0 : n;
};
UI.prototype.decNotifications = function(n) {
  this.setNotifications(this.notifications - 1);
};
// Determine whether UProxy is connected to |network|.
UI.prototype.isOnline = function(network) {
  return (model && model.identityStatus &&
          model.identityStatus[network] &&
          'online' == model.identityStatus[network].status);
};
UI.prototype.isOffline = function(network) {
  return (!model || !model.identityStatus ||
          !model.identityStatus[network] ||
          'offline' == model.identityStatus[network].status);
};
// Whether UProxy is logged in to *any* network.
UI.prototype.loggedIn = function() {
  return this.isOnline('google') || this.isOnline('facebook');
};
UI.prototype.loggedOut = function() {
  return this.isOffline('google') && this.isOffline('facebook');
};
var ui = new UI();

// Connect to the App.
console.log('Connecting to App...');
var connectedToApp = false;
var appChannel = new FreedomConnector(FREEDOM_CHROME_APP_ID, {
    name: 'uproxy-extension-to-app-port' });


function wireUItoApp() {
  console.log('Wiring UI to backend...');
  appChannel.on('state-change', function(patchMsg) {
    // console.log(patchMsg[0]);
    if (patchMsg[0].path === '') {
      model = patchMsg[0].value;
    } else {
      jsonpatch.apply(model, patchMsg);
      console.log(model);
    }

    // Count up notifications
    var notifications = 0;
    for (var userId in model.roster) {
      var user = model.roster[userId];
      notifications += user.hasNotification? 1:0;
    }
    ui.notifications = notifications;
    ui.setNotifications(notifications);

    // Generate list ordered by names.
    var uids = Object.keys(model.roster);
    var names = uids.map(function(id) { return model.roster[id].name; });
    names.sort();
    // console.log(names);

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
    onStateChange.dispatch(patchMsg);
  });
}
  // Attach state-change listener to update UI from the backend.
appChannel.onConnected.addListener(wireUItoApp);

function reconnectToApp() {
  console.log('Disconnected. Attempting to reconnect to app...');
  appChannel.connect();
}

function initialize() {
  appChannel.emit('ui-ready');
}

// Automatically attempt to reconnect when disconnected.
appChannel.onConnected.addListener(initialize);
appChannel.onDisconnected.addListener(reconnectToApp);

// appChannel.onDisconnected.removeListener(wireUItoApp);

window.onunload = function() {
  // appChannel.removeListener(onStateChange);
  appChannel.onConnected.removeListener(wireUItoApp);
};
appChannel.connect();
