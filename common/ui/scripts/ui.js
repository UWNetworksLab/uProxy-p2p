/**
 * ui.js
 *
 * Common User Interface state holder and changer.
 * TODO: firefox bindings.
 */
'use strict';

// Main UI class.
// Can be constructed with |browserType| being either 'chrome' or 'firefox'.
function UI(browserType) {
  this.ICON_DIR = '../common/ui/icons/';

  this.networks = ['google', 'facebook', 'xmpp'];

  this.notifications = 0;
  // TODO: splash should be set by state.
  this.rosterNudge = false;
  this.advancedOptions = false;
  this.searchBar = true;
  this.lastSync = new Date();

  this.isProxying = false;  // Whether we are proxying through someone.
  this.accessIds = 0;  // How many people are proxying through us.

  // Keep track of currently viewed contact and instance.
  this.contact = null;
  this.instance = null;

  // If we are proxying, keep track of the instance.
  this.proxy = null;

  // When the description changes while the text field loses focus, it
  // automatically updates.
  this.oldDescription = '';
}

UI.prototype.setNotifications = function(n) {
  if (n > 0) {
    this.setLabel(n);
  } else {
    this.setLabel('');
  }
  this.notifications = n < 0? 0 : n;
};

UI.prototype.decNotifications = function(n) {
  this.setNotifications(this.notifications - 1);
};

UI.prototype.setIcon = function(iconFile) {
  chrome.browserAction.setIcon({
    path: this.ICON_DIR + iconFile
  });
};

UI.prototype.setLabel = function(text) {
  chrome.browserAction.setBadgeText({ text: '' + text });
};

// Hackish way to fire the onStateChange dispatcher.
UI.prototype.refreshDOM = function() {
  onStateChange.dispatch();
};

UI.prototype.setProxying = function(isProxying) {
  this.isProxying = isProxying;
  if (isProxying) {
    this.setIcon('uproxy-19-p.png');
  } else {
    this.setIcon('uproxy-19.png');
  }
};

UI.prototype.setClients = function(numClients) {
  this.numClients = numClients;
  if (numClients > 0) {
    chrome.browserAction.setBadgeBackgroundColor({color: '#008'});
    this.setLabel('↓');
  } else {
    chrome.browserAction.setBadgeBackgroundColor({color: '#800'});
  }
}


// Make sure counters and UI-only state holders correctly reflect the model.
UI.prototype.synchronize = function() {
  // Count up notifications
  var n = 0;
  for (var userId in model.roster) {
    var user = model.roster[userId];
    var instanceId = null;
    for (var clientId in user.clients) {
      instanceId = model.clientToInstance[clientId];
      if (instanceId) {
        if (model.instances[instanceId].notify) {
          console.log('found user ' + user.userId + ' with notification.');
          user.hasNotification = true;
          break;
        }
      }
    }
    if (user.hasNotification) {
      n++;
    }
  }
  this.setNotifications(n);

  // Run through instances, count up clients.
  var c = 0;
  for (var iId in model.instances) {
    var instance = model.instances[iId];
    if ('running' == instance.status.client) {
      c++;
    }
    if ('running' == instance.status.proxy) {
      this.isProxying = true;
    }
  }
  this.setClients(c);

  // Generate list ordered by names.
  var uids = Object.keys(model.roster);
  var names = uids.map(function(id) { return model.roster[id].name; });
  names.sort();
  return true;
};

