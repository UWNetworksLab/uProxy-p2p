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

  this.networks = ['google', 'facebook'];

  this.notifications = 0;
  // TODO: splash should be set by state.
  this.rosterNudge = false;
  this.advancedOptions = false;
  this.searchBar = true;
  this.pendingProxyTrustChange = false;
  this.pendingClientTrustChange = false;

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

  // Initial filter state.
  this.filters = {
      'online': true,
      'myAccess': false,
      'friendsAccess': false,
      'uproxy': false
  };
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


// -------------------------------- Filters ------------------------------------
// Toggling |filter| changes the visibility and ordering of roster entries.
UI.prototype.toggleFilter = function(filter) {
  if (undefined === this.filters[filter]) {
    console.error('Filter "' + filter + '" is not a valid filter.');
    return false;
  }
  console.log('Toggling ' + filter + ' : ' + this.filters[filter]);
  this.filters[filter] = !this.filters[filter];
};

// Returns |true| if contact |c| should *not* appear in the roster.
UI.prototype.contactIsFiltered = function(c) {
  var searchText = this.search,
      compareString = c.name.toLowerCase();
  // First, compare filters.
  if ((this.filters.online        && !c.online)    ||
      (this.filters.uproxy        && !c.canUProxy) ||
      (this.filters.myAccess      && !c.givesMe) ||
      (this.filters.friendsAccess && !c.usesMe)) {
    return true;
  }
  // Otherwise, if there is no search text, this contact is visible.
  if (!searchText) {
    return false;
  }
  if (compareString.indexOf(searchText) >= 0) {
    return false;
  }
  return true;  // Does not match the search text, should be hidden.
};



// Make sure counters and UI-only state holders correctly reflect the model.
UI.prototype.synchronize = function() {

  var n = 0;  // Count up notifications
  for (var userId in model.roster) {
    var user = model.roster[userId];
    var instanceId = null;
    var hasNotification = false;
    var canUProxy = false;
    for (var clientId in user.clients) {
      instanceId = model.clientToInstance[clientId];
      // TODO(uzimizu): Support multiple instances.
      if (!instanceId) {
        continue;
      }
      // Find instance associated with the user.
      var instance = model.instances[instanceId];
      if (!instance) {
        continue;
      }
      canUProxy = true;
      if (instance.notify) {
        console.log('found user ' + user.userId + ' with notification.');
        hasNotification = true;
      }
      // Pass-over the trust value to user-level.
      // TODO(uzimizu): Take the assumption of highest trust level, once support
      // for multiple instances has arrived.
      user.trust = instance.trust;
      user.givesMe = ('no' != user.trust.asProxy);
      user.usesMe = ('no' != user.trust.asClient);
      break;
    }
    user.canUProxy = canUProxy;
    user.hasNotification = hasNotification;
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

  this.pendingProxyTrustChange = false;
  this.pendingClientTrustChange = false;

  // Generate list ordered by names.
  var uids = Object.keys(model.roster);
  var names = uids.map(function(id) { return model.roster[id].name; });
  names.sort();
  return true;
};

