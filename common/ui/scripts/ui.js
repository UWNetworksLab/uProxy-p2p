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
  this.splashPage = false;
  this.advancedOptions = false;
  this.searchBar = true;
  this.pendingProxyTrustChange = false;
  this.pendingClientTrustChange = false;

  this.isProxying = false;  // Whether we are proxying through someone.
  this.accessIds = 0;  // How many people are proxying through us.

  // Keep track of currently viewed contact and instance.
  this.contact = null;
  this.contactUnwatch = null;
  this.instance = null;
  this.instanceUnwatch = null;  // For angular binding.

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


// -------------------------- Browser Icons / Labels  --------------------------
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


// --------------------------- Focus & Notifications ---------------------------

UI.prototype.focusOnContact = function(contact) {
  console.log('focusing on contact ' + contact);
  this.contact = contact;
  this.notificationSeen(contact);
  this.rosterNudge = true;
};

// Going back from the contact view to the roster view.
UI.prototype.returnToRoster = function() {
  console.log('returning to roster! ' + this.contact);
  if (this.contact && this.contact.hasNotification) {
    console.log('sending notification seen');
    this.notificationSeen(this.contact);  // Works if there *is* a contact.
    this.contact = null;
  }
  this.rosterNudge = false;
}

// Notifications occur on the user level. The message sent to the app side
// will also remove the notification flag from the corresponding instance(s).
UI.prototype.notificationSeen = function(user) {
  if (!user.hasNotification) {
    return;  // Ignore if user has no notification.
  }
  appChannel.emit('notification-seen', user.userId);
  user.hasNotification = false;
  this.decNotifications();
};

UI.prototype.setNotifications = function(n) {
  this.setLabel(n > 0? n : '');
  this.notifications = n < 0? 0 : n;
};

UI.prototype.decNotifications = function(n) {
  this.setNotifications(this.notifications - 1);
};

// ------------------------------ Data Syncing ---------------------------------

function _getMyId() {
  for (var id in model.me.identities) {
    return id;
  }
  return null;
}

UI.prototype.syncMe = function() {
  var id = _getMyId();
  if (!id) {
    console.log('I don\'t exist yet! :(');
    return;
  }
  var identity = model.me.identities[id];
  this.myName = identity.name;
  this.myPic = identity.imageData || '';
};

UI.prototype.syncUser = function(user) {
  var instanceId = null,
      instance = null,
      online = false,           // For flag updates.
      canUProxy = false,
      hasNotification = false,
      isActiveClient = false,
      isActiveProxy = false,
      onGoogle = false,
      onFB = false,
      onXMPP = false;

  for (var clientId in user.clients) {
    // Determine network state / flags for filtering purposes.
    var client = user.clients[clientId];
    onGoogle = onGoogle || 'google' == client.network
    onFB     = onFB     || 'facebook' == client.network
    onXMPP   = onXMPP   || 'xmpp' == client.network
    online = online || (
        ('manual' != client.network) &&
        ('messageable' == client.status || 'online' == client.status));

    // Check if this client has a corresponding instance...
    instanceId = model.clientToInstance[clientId];
    if (!instanceId)  continue;
    instance = model.instances[instanceId];
    if (!instance)    continue;
    canUProxy = true;  // At this point, we know this user can UProxy.
    // TODO(uzimizu): Support multiple notifications, with messages.
    hasNotification = hasNotification || instance.notify;

    // Pass-over the trust value to user-level.
    // TODO(uzimizu): When we have multiple instances,
    // take the assumption of highest trust level.
    user.trust = instance.trust;
    user.givesMe = ('no' != user.trust.asProxy);
    user.usesMe = ('no' != user.trust.asClient);
    isActiveClient = isActiveClient || 'running'==instance.status.client;
    isActiveProxy = isActiveProxy || 'running'==instance.status.proxy;
    break;  // TODO(uzimizu): Support multiple instances.
  }

  // Apply user-level flags.
  user.online = online;
  user.canUProxy = canUProxy;
  user.hasNotification = hasNotification;
  user.isActiveClient = isActiveClient;
  user.isActiveProxy = isActiveProxy;
  user.onGoogle = onGoogle;
  user.onFB = onFB;
  user.onXMPP = onXMPP;
}

// Make sure counters and UI-only state holders correctly reflect the model.
UI.prototype.synchronize = function() {

  var n = 0;  // Count up notifications
  for (var userId in model.roster) {
    var user = model.roster[userId];
    this.syncUser(user);
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
  // var uids = Object.keys(model.roster);
  // var names = uids.map(function(id) { return model.roster[id].name; });
  // names.sort();
  this.syncMe();
  return true;
};

