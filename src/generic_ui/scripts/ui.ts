/**
 * ui.ts
 *
 * Common User Interface state holder and changer.
 * TODO: firefox bindings.
 */
/// <reference path='user.ts' />
/// <reference path='../../uproxy.ts'/>
/// <reference path='../../interfaces/ui.d.ts'/>
/// <reference path='../../interfaces/notify.d.ts'/>
/// <reference path='../../interfaces/lib/chrome/chrome.d.ts'/>

declare var model         :UI.Model;

module UI {

  var REFRESH_TIMEOUT :number = 500;  // ms.

  /**
   * Enumeration of mutually-exclusive view states.
   */
  export enum View {
    ROSTER,
    ACCESS,
    OPTIONS,
    CHAT
  }

  /**
   * Boolean toggles which influence other appearances.
   */
  export interface Toggles {
    splash  :boolean;
    options :boolean;
    search  :boolean;
  }

  /**
   * Structure of the uProxy UI model object:
   * TODO: Probably put the model in its own file.
   */
  export interface Model {
    networks :{ [name:string] :UI.Network };
    // TODO: Other top-level generic info...

    // This is a 'global' roster - a combination of all User Profiles.
    // TODO: remove. The way the UI works will soon change drastically.
    roster :{ [userId:string] :User }
  }

  // TODO: remove this once extension model is cleaned up.
  export interface modelForAngular extends UI.Model {
    clientToInstance :{[clientId :string] :string };
    instances :{[instanceId :string] :UI.Instance};
  }

  export interface RootScope extends ng.IRootScopeService {
    ui :uProxy.UIAPI;
    core :uProxy.CoreAPI;
    model :modelForAngular;
    isOnline(network :string) : boolean;
    isOffline(network :string) : boolean;
    loggedIn() : boolean;
    loggedOut() : boolean;
    resetState() : void;
    prettyNetworkName(networkId :string) : string;
  }

  /**
   * Specific to one particular Social network.
   */
  export interface Network {
    name   :string;
    online :boolean;
    roster :{ [userId:string] :User }
  }

  /**
   * The User Interface class.
   *
   * Contains UI-related state and functions, which angular will access.
   * Manipulates the payloads received from UPDATES from the Core in preparation
   * for UI interaction.
   * Any COMMANDs from the UI should be directly called from the 'core' object.
   */
  export class UserInterface implements uProxy.UIAPI {

    public DEBUG = false;  // Set to true to show the model in the UI.

    // Appearance.
    public view :View;
    public toggles :Toggles;

    // Keep track of currently viewed contact and instance.
    // public focus :InstancePath;
    public network :string = 'google';
    public user :User = null;
    public instance :UI.Instance = null;
    public proxy :UI.Instance = null;  // If we are proxying, keep track of the instance.

    notifications = 0;
    advancedOptions = false;
    // TODO: Pull search / filters into its own class.
    search = '';
    numClients = 0;
    myName = '';
    myPic = null;

    isProxying = false;  // Whether we are proxying through someone.
    accessIds = 0;  // How many people are proxying through us.

    // When the description changes while the text field loses focus, it
    // automatically updates.
    oldDescription :string = '';

    // Initial filter state.
    public filters = {
        'online': true,
        'myAccess': false,
        'friendsAccess': false,
        'uproxy': false
    };

    /**
     * UI must be constructed with hooks to Notifications and Core.
     * Upon construction, the UI installs update handlers on core.
     */
    constructor(
        public core   :uProxy.CoreAPI,
        public notify :INotifications) {

      // TODO: Determine the best way to describe view transitions.
      this.view = View.ROSTER;
      this.toggles = {
        splash:  true,
        options: false,
        search:  true
      };

      // Attach handlers for UPDATES received from core.
      // TODO: Implement the rest of the fine-grained state updates.
      // (We begin with the simplest, total state update, above.)
      core.onUpdate(uProxy.Update.ALL, (state :Object) => {
        console.log('Received uProxy.Update.ALL:', state);
        // TODO: Implement this after a better payload message is implemented.
        // There is now a difference between the UI Model and the state object
        // from the core, so one-to-one mappinsg from the old json-patch code cannot
        // work.
      });

      // Add or update the online status of a network.
      core.onUpdate(uProxy.Update.NETWORK, this.syncNetwork_);

      // Attach handlers for USER updates.
      core.onUpdate(uProxy.Update.USER_SELF, (payload :UI.UserMessage) => {
        console.log('uProxy.Update.USER_SELF:', payload);
        // Instead of adding to the roster, update the local user information.
      });
      core.onUpdate(uProxy.Update.USER_FRIEND, (payload :UI.UserMessage) => {
        console.log('uProxy.Update.USER_FRIEND:', payload);
        this.syncUser(payload);
      });

      console.log('Created the UserInterface');
    }

    update = (type:uProxy.Update, data?:any) => {
      // TODO: Implement.
    }

    // ------------------------------- Views ----------------------------------
    public isSplash = () : boolean => { return this.toggles.splash; }
    public isRoster = () : boolean => { return View.ROSTER == this.view; }
    public isAccess = () : boolean => { return View.ACCESS == this.view; }

    // Refreshing with angular from outside angular.
    private refreshTimer = null;
    private refreshNeeded :boolean = false;
    private refreshFunction_ :Function = () => {
      console.warn('Angular has not hooked into UI refresh!');
    };

    /**
     * Rate-limited DOM refreshing.
     * TODO: Put into a 'refreshing' service.
     */
    public refreshDOM = () => {
      if (!this.refreshFunction_) {
        return;
      }
      if (this.refreshTimer) {
        this.refreshNeeded = true;
      } else {
        this.refreshFunction_();
        this.refreshNeeded = false;
        // Set a timeout for the next possible refresh, if it exists.
        this.refreshTimer = setTimeout(() => {
          this.refreshTimer = null;
          if (this.refreshNeeded) {
            this.refreshDOM();
          }
          this.refreshNeeded = false;
        }, REFRESH_TIMEOUT);
      }
    }
    public setRefreshHandler = (f :Function) => {
      this.refreshDOM = () => {
        f();
      };
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

    // ------------------------------- Proxying ----------------------------------
    // TODO Replace this with a 'Proxy Service'.
    /**
     * Starts proxying by updating UI-specific state, then passing the start
     * COMMAND to the core.
     * Assumes that there is a 'current instance' available.
     */
    public startProxying = () => {
      if (!this.user || !this.instance) {
        console.warn('Cannot stop proxying without a current instance.');
      }
      // Prepare the instance path.
      var path = <InstancePath>{
        network: 'google',
        userId: this.user.userId,
        instanceId: this.instance.instanceId
      };
      this.core.start(path);
      this.proxy = this.instance;
      this._setProxying(true);
    }

    /**
     * Stops proxying by updating UI-specific state, and passing the stop
     * COMMAND to the core.
     */
    public stopProxying = () => {
      if (!this.instance) {
        console.warn('Stop Proxying called while not proxying.');
        return;
      }
      this._setProxying(false);
      this.core.stop();
    }

    _setProxying = (isProxying : boolean) => {
      this.isProxying = isProxying;
      if (isProxying) {
        this.notify.setIcon('uproxy-19-p.png');
      } else {
        this.notify.setIcon('uproxy-19.png');
      }
    }

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
     * Returns |true| if contact |c| should *not* currently be visible in the
     * roster.
     */
    contactIsFiltered = (user:UI.User) => {
      var searchText = this.search,
          compareString = user.name.toLowerCase();
      // First, compare filters.
      if ((this.filters.online        && !user.online)    ||
          (this.filters.uproxy        && !user.canUProxy) ||
          (this.filters.myAccess      && !user.givesMe)   ||
          (this.filters.friendsAccess && !user.usesMe)) {
        return true;
      }
      // Otherwise, if there is no search text, this.user is visible.
      if (!searchText) {
        return false;
      }
      if (compareString.indexOf(searchText) >= 0) {
        return false;
      }
      return true;  // Does not match the search text, should be hidden.
    }

    // --------------------------- Focus & Notifications ---------------------------
    /**
     * Handler for when the user clicks on the entry in the roster for a User.
     * Sets the UI's 'current' User and Instance, if it exists.
     */
    public focusOnUser = (user:UI.User) => {
      this.view = View.ACCESS;
      console.log('focusing on user ' + user);
      this.user = user;
      this.dismissNotification(user);
      // For now, default to the first instance that the user has.
      // TODO: Support multiple instances in the UI.
      if (user.instances.length > 0) {
        this.instance = user.instances[0];
      }
    }

    /*
     * Change from the detailed access view back to the roster view.
     * Clears the 'current user'.
     */
    public returnToRoster = () => {
      this.view = View.ROSTER;
      console.log('returning to roster! ' + this.user);
      if (this.user && this.user.hasNotification) {
        console.log('sending notification seen');
        this.dismissNotification(this.user);  // Works if there *is* a contact.
        this.user = null;
      }
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
    dismissNotification = (user) => {
      if (!user.hasNotification) {
        return;  // Ignore if user has no notification.
      }
      this.core.dismissNotification(user.userId);
      user.hasNotification = false;
      this.decNotifications();
    }

    syncInstance = (instance : any) => {}
    updateMappings = () => {}

    updateIdentity = (identity) => {}
    sendConsent = () => {}
    addNotification = () => {}

    /**
     * Synchronize a new network to be visible on this UI.
     */
    private syncNetwork_ = (network :UI.NetworkMessage) => {
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
    }

    // Determine whether UProxy is connected to some network.
    // TODO: Make these functional and write specs.
    public loggedIn = () => {
      for (var networkId in model.networks) {
        if (model.networks[networkId].online) {
          return true;
        }
      }
      return false;
    }

    // This is *NOT* the inverse of loggedIn, because it is possible to be
    // "logging in"
    // Not Logged-out if state is not logged out for any network.
    public loggedOut = () => {
      return false;
      for (var networkId in model.networks) {
        if (!model.networks[networkId].online) {
          return false;
        }
      }
      return true;
    }

    // Synchronize the data about the current user.
    // TODO: Be able to sync local instance, per network.

    /**
     * Synchronize data about some friend.
     */
    public syncUser = (payload :UI.UserMessage) => {
      var network = model.networks[payload.network];
      if (!network) {
        console.warn('Received USER for non-existing network.');
        return;
      }
      // Construct a UI-specific user object.
      var profile = payload.user;
      // Update / create if necessary a user, both in the network-specific
      // roster and the global roster.
      var user :UI.User;
      user = network.roster[profile.userId];
      if (!user) {
        user = new UI.User(profile.userId);
        network.roster[profile.userId] = user;
        model.roster[profile.userId] = user;
      }
      user.update(profile);
      user.refreshStatus(payload.clients);
      user.setInstances(payload.instances);
      // Update the 'current instance' of UI if this is the correct user.
      if (this.user === user) {
        this.instance = user.instances[0];
      }
      this.refreshDOM();
    };

    /*
     * Make sure counters and UI-only state holders correctly reflect the model.
     * If |previousPatch| is provided, the search is optimized to only sync the
     * relevant entries.
     * TODO: Redo this for the new paradigm of network rosters.
     */
    sync = (previousPatch?:any) => {
      // var n = 0;  // Count up notifications
      // for (var userId in model.roster) {
        // var user = model.roster[userId];
        // this.syncUser(user);
        // if (user.hasNotification) {
          // n++;
        // }
      // }
      // this.setNotifications(n);
      // Run through instances, count up clients.
      // var c = 0;
      // for (var iId in model.instances) {
        // var instance = model.instances[iId];
        // if ('running' == instance.status.client) {
          // c++;
        // }
        // if ('running' == instance.status.proxy) {
          // this.isProxying = true;
        // }
      // }
      // this.setClients(c);

      // Generate list ordered by names.
      // if (!this.myName) {
        // this.syncMe();
      // }
      // return true;
    }

  }  // class UserInterface

}  // module UI
