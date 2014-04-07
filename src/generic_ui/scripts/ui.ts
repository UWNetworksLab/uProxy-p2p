/**
 * ui.ts
 *
 * Common User Interface state holder and changer.
 * TODO: firefox bindings.
 */
/// <reference path='../../interfaces/core.d.ts'/>
/// <reference path='../../interfaces/notify.d.ts'/>
/// <reference path='../../interfaces/ui.d.ts'/>
/// <reference path='../../../third_party/DefinitelyTyped/chrome/chrome.d.ts'/>

declare var model         :any;
declare var onStateChange :any;

module UI {

  // Main UI class.
  // Can be constructed with |browserType| being either 'chrome' or 'firefox'.
  export class UserInterface implements uProxy.UIAPI {

    // Primary interactions between major components.
    core   :uProxy.CoreAPI;
    notify :INotifications;

    // TODO: Make these networks correspond to the actual social bit.
    networks = ['google', 'facebook', 'xmpp'];
    notifications = 0;
    // TODO: splash should be set by state.
    accessView = false;
    splashPage = false;
    advancedOptions = false;
    searchBar = true;
    search = '';
    chatView = false;
    numClients = 0;
    myName = '';
    myPic = null;
    // Disable action buttons immediately after clicking, until state updates
    // completely to prevent duplicate clicks.
    pendingProxyTrustChange = false;
    pendingClientTrustChange = false;

    isProxying = false;  // Whether we are proxying through someone.
    accessIds = 0;  // How many people are proxying through us.
    isConnected:boolean = false;

    constructor(public notifier:INotifications, core:uProxy.CoreAPI) {
      this.notify = notifier;
      this.core = core;
      core.onConnected = () => {
        this.isConnected = true;
      };
      core.onDisconnected = () => {
        this.isConnected = false;
      };

    }

    // Keep track of currently viewed contact and instance.
    contact = null;
    contactUnwatch = null;
    instance = null;
    instanceUnwatch = null;  // For angular binding.

    proxy = null;  // If we are proxying, keep track of the instance.

    // When the description changes while the text field loses focus, it
    // automatically updates.
    oldDescription :string = '';

    // Initial filter state.
    filters = {
        'online': true,
        'myAccess': false,
        'friendsAccess': false,
        'uproxy': false
    };

    // Hackish way to fire the onStateChange dispatcher.
    refreshDOM = () => {
      onStateChange.dispatch();
    }

    setClients = (numClients) => {
      this.numClients = numClients;
      if (numClients > 0) {
        this.notify.setColor('#008');
        this.notify.setLabel('↓');
      } else {
        this.notify.setColor('#800');
      }
    }

    // -------------------------------- Consent ----------------------------------
    modifyConsent = (instanceId :string, action  :uProxy.Consent.Action) => {
      if (!this.core) {
        console.log('UI not connected to core - cannot modify consent.');
        return;
      }
      this.core.modifyConsent(instanceId, action);
    }

    // ------------------------------- Proxying ----------------------------------
    // TODO: Type the Instance
    startProxying = (instance) => {
      this.core.start(instance.instanceId);
      this.proxy = instance;
      this._setProxying(true);
    }

    stopProxying = () => {
      if (!this.instance) {
        console.warn('Stop Proxying called while not proxying.');
        return;
      }
      this._setProxying(false);
      this.core.stop(this.instance.instanceId);
    }

    _setProxying = (isProxying : boolean) => {
      this.isProxying = isProxying;
      if (isProxying) {
        this.notify.setIcon('uproxy-19-p.png');
      } else {
        this.notify.setIcon('uproxy-19.png');
      }
    }

    login = (network) => {
      this.core.login(network);
      this.splashPage = false;
    }

    logout = (network) => {
      this.core.logout(network);
      this.proxy = null;
    }

    updateDescription = (description) => {
      // Only update on different description.
      if (this.oldDescription &&
         (this.oldDescription != description)) {
        this.core.updateDescription(description);
      }
      this.oldDescription = description;
    }

    sendInstance = (clientId) => {
      this.core.sendInstance(clientId);
    }

    reset = () => { this.core.reset(); }

    // -------------------------------- Filters ----------------------------------
    /**
     * Toggling |filter| changes the visibility and ordering of roster entries.
     */
    toggleFilter = (filter) => {
      if (undefined === this.filters[filter]) {
        console.error('Filter "' + filter + '" is not a valid filter.');
        return false;
      }
      console.log('Toggling ' + filter + ' : ' + this.filters[filter]);
      this.filters[filter] = !this.filters[filter];
    }

    /**
     * Returns |true| if contact |c| should *not* appear in the roster.
     */
    contactIsFiltered = (c) => {
      var searchText = this.search,
          compareString = c.name.toLowerCase();
      // First, compare filters.
      if ((this.filters.online        && !c.online)    ||
          (this.filters.uproxy        && !c.canUProxy) ||
          (this.filters.myAccess      && !c.givesMe)   ||
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
    }

    // --------------------------- Focus & Notifications ---------------------------
    focusOnContact = (contact) => {
      console.log('focusing on contact ' + contact);
      this.contact = contact;
      this.notificationSeen(contact);
      this.accessView = true;
    }

    /*
     * Going back from the contact view to the roster view.
     */
    returnToRoster = () => {
      console.log('returning to roster! ' + this.contact);
      if (this.contact && this.contact.hasNotification) {
        console.log('sending notification seen');
        this.notificationSeen(this.contact);  // Works if there *is* a contact.
        this.contact = null;
      }
      this.accessView = false;
    }

    setNotifications = (n) => {
      this.notify.setLabel(n > 0? n : '');
      this.notifications = n < 0? 0 : n;
    }

    decNotifications = () => {
      this.setNotifications(this.notifications - 1);
    }

    /**
     * Notifications occur on the user level. The message sent to the app side
     * will also remove the notification flag from the corresponding instance(s).
     */
    notificationSeen = (user) => {
      if (!user.hasNotification) {
        return;  // Ignore if user has no notification.
      }
      this.core.notificationSeen(user.userId);
      user.hasNotification = false;
      this.decNotifications();
    }

    syncInstance = (instance : any) => {}
    updateMappings = () => {}

    updateIdentity = (identity) => {}
    sendConsent = () => {}
    addNotification = () => {}

    // Synchronize the data about the current user.
    syncMe = () => {
      var id = _getMyId();
      if (!id) {
        console.log('My own identities missing for now....');
        return;
      }
      var identity = model.me.identities[id];
      this.myName = identity.name;
      this.myPic = identity.imageData || '';
      console.log('Synced my own identity. ', identity);
    }

    /**
     * Synchronize data about some friend.
     */
    syncUser = (user) => {
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
        // TODO(keroserene): When we have multiple instances,
        // take the assumption of highest trust level.
        user.trust = instance.trust;
        user.givesMe = ('no' != user.trust.asProxy);
        user.usesMe = ('no' != user.trust.asClient);
        isActiveClient = isActiveClient || 'running'==instance.status.client;
        isActiveProxy = isActiveProxy || 'running'==instance.status.proxy;
        break;  // TODO(uzimizu): Support multiple instances.
      }

      // Apply user-level flags.
      // TODO: Deprecate this once we move to instance-centrism.
      user.online = online;
      user.canUProxy = canUProxy;
      user.hasNotification = hasNotification;
      user.isActiveClient = isActiveClient;
      user.isActiveProxy = isActiveProxy;
      user.onGoogle = onGoogle;
      user.onFB = onFB;
      user.onXMPP = onXMPP;
    }

    /*
     * Make sure counters and UI-only state holders correctly reflect the model.
     * If |previousPatch| is provided, the search is optimized to only sync the
     * relevant entries.
     */
    sync = (previousPatch?:any) => {
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
      if (!this.myName) {
        this.syncMe();
      }
      return true;
    }

  }  // class UserInterface

}  // module UI


// ------------------------------ Data Syncing ---------------------------------

function _getMyId() {
  for (var id in model.me.identities) {
    return id;
  }
  return null;
}
