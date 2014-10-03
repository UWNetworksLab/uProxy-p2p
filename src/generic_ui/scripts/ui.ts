/**
 * ui.ts
 *
 * Common User Interface state holder and changer.
 * TODO: firefox bindings.
 */
/// <reference path='user.ts' />
/// <reference path='../../uproxy.ts'/>
/// <reference path='../../interfaces/ui.d.ts'/>
/// <reference path='../../interfaces/browser_action.d.ts'/>
/// <reference path='../../interfaces/browser-proxy-config.d.ts'/>


declare var model         :UI.Model;
declare var proxyConfig   :IBrowserProxyConfig;


module UI {

  export var DEFAULT_USER_IMG = 'icons/contact-default.png';

  /**
   * Enumeration of mutually-exclusive view states.
   */
  export enum View {
    SPLASH = 0,
    ROSTER,
    USER,
    NETWORKS,
    SETTINGS,
  }

  export enum Gestalt {
    GIVING = 101,
    GETTING
  }

  /**
   * Structure of the uProxy UI model object:
   * TODO: Probably put the model in its own file.
   */
  export interface Model {
    networks : UI.Network[];
    // TODO: Other top-level generic info...

    // This is a 'global' roster - a combination of all User Profiles.
    // TODO: remove this if possible and just use network.roster
    roster :User[];

    description :string;
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
   * Keeps persistent state between the popup opening and closing.
   * Manipulates the payloads received from UPDATES from the Core in preparation
   * for UI interaction.
   * Any COMMANDs from the UI should be directly called from the 'core' object.
   */
  export class UserInterface implements uProxy.UIAPI {
    public DEBUG = false;  // Set to true to show the model in the UI.

    public view :View;  // Appearance.

    // Keep track of currently viewed contact and instance.
    public network :string = 'google';

    // TODO: Put this into the 'auth' service, which will eventually include
    // sas-rtc.
    public localFingerprint :string = null;
    numClients = 0;
    myName = '';
    myPic = null;

    accessIds = 0;  // How many people are proxying through us.

    // When the description changes while the text field loses focus, it
    // automatically updates.
    oldDescription :string = '';

    /**
     * UI must be constructed with hooks to Notifications and Core.
     * Upon construction, the UI installs update handlers on core.
     */
    constructor(
        public core   :uProxy.CoreAPI,
        public browserAction :BrowserAction) {

      // TODO: Determine the best way to describe view transitions.
      this.view = View.SPLASH;  // Begin at the splash intro.

      // Attach handlers for UPDATES received from core.
      // TODO: Implement the rest of the fine-grained state updates.
      // (We begin with the simplest, total state update, above.)
      core.onUpdate(uProxy.Update.ALL, (state :Object) => {
        console.log('Received uProxy.Update.ALL:', state);
        model.description = state['description'];
        // TODO: Implement this after a better payload message is implemented.
        // There is now a difference between the UI Model and the state object
        // from the core, so one-to-one mappinsg from the old json-patch code cannot
        // work.
      });

      // Add or update the online status of a network.
      core.onUpdate(uProxy.Update.NETWORK, this.syncNetwork_);

      // Attach handlers for USER updates.
      core.onUpdate(uProxy.Update.USER_SELF, (payload :UI.UserMessage) => {
        // Instead of adding to the roster, update the local user information.
        console.log('uProxy.Update.USER_SELF:', payload);
        var profile :UI.UserProfileMessage = payload.user;
        this.myPic = profile.imageData || DEFAULT_USER_IMG;
        this.myName = profile.name;
      });
      core.onUpdate(uProxy.Update.USER_FRIEND, (payload :UI.UserMessage) => {
        console.log('uProxy.Update.USER_FRIEND:', payload);
        this.syncUser(payload);
      });
      core.onUpdate(uProxy.Update.ERROR, (errorText :string) => {
        console.warn('uProxy.Update.ERROR: ' + errorText);
        this.showNotification(errorText);
      });
      core.onUpdate(uProxy.Update.NOTIFICATION, (notificationText :string) => {
        console.warn('uProxy.Update.NOTIFICATION: ' + notificationText);
        this.showNotification(notificationText);
      });
      core.onUpdate(uProxy.Update.PROXYING_STOPPED, () => {
        this.stopProxyingInUiAndConfig();
      });

      core.onUpdate(uProxy.Update.LOCAL_FINGERPRINT, (payload :string) => {
        this.localFingerprint = payload;
        console.log('Received local fingerprint: ' + this.localFingerprint);
      });

      core.onUpdate(uProxy.Update.MANUAL_NETWORK_OUTBOUND_MESSAGE,
                    (message :uProxy.Message) => {
        console.log('Manual network outbound message: ' +
                    JSON.stringify(message));
        // TODO: Display the message in the 'manual network' UI.
      });

      console.log('Created the UserInterface');
    }

    public showNotification = (notificationText :string) => {
      new Notification('uProxy', { body: notificationText,
                                   icon: 'icons/uproxy-128.png'});
    }

    /**
     * Removes proxy indicators from UI and undoes proxy configuration
     * (e.g. chrome.proxy settings).
     */
    public stopProxyingInUiAndConfig = () => {
      this._setProxying(false);
      proxyConfig.stopUsingProxy();
    }

    _setProxying = (isProxying : boolean) => {
      if (isProxying) {
        this.browserAction.setIcon('uproxy-19-p.png');
      } else {
        this.browserAction.setIcon('uproxy-19.png');
      }
    }

    syncInstance = (instance : any) => {}
    updateMappings = () => {}

    sendConsent = () => {}

    private getNetwork = (networkName :string) => {
      for (var networkId in model.networks) {
        if (model.networks[networkId].name === networkName) {
          return model.networks[networkId];
        }
      }
      return null;
    }

    /**
     * Synchronize a new network to be visible on this UI.
     */
    private syncNetwork_ = (network :UI.NetworkMessage) => {
      console.log('uProxy.Update.NETWORK', network, model.networks);
      console.log(model);
      var existingNetwork = this.getNetwork(network.name);
      if (existingNetwork) {
        existingNetwork.online = network.online;
      } else {
        model.networks.push({
          name:   network.name,
          online: network.online,
          roster: {}
        });
      }
    }

    // Determine whether uProxy is connected to some network.
    // TODO: Make these functional and write specs.
    public loggedIn = () => {
      for (var networkId in model.networks) {
        if (model.networks[networkId].online &&
            // TODO: figure out how to reference Social.MANUAL_NETWORK_ID here
            model.networks[networkId].name !== "manual") {
          return true;
        }
      }
      return false;
    }

    // Synchronize the data about the current user.
    // TODO: Be able to sync local instance, per network.

    /**
     * Synchronize data about some friend.
     */
    public syncUser = (payload :UI.UserMessage) => {
      var network = this.getNetwork(payload.network);
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
      // CONSIDER: we might want to check if this user has been our proxy
      // server and if so stop the proxying if they are no longer proxying
      // for us (e.g. they were disconnected).  Currently we are sending an
      // explicit stop proxy message from the app to stop proxying.
      if (!user) {
        // New user.
        user = new UI.User(profile.userId);
        network.roster[profile.userId] = user;
        model.roster.push(user);
      }
      user.update(profile);
      user.instances = payload.instances;

      user.canUProxy = user.instances.some((instance) => {
        return instance.isOnline;
      });

      // Update givesMe and usesMe fields based on whether any instance
      // has these permissions.
      // TODO: we may want to include offered permissions here (even if the
      // peer hasn't accepted the offer yet).
      for (var i = 0; i < user.instances.length; ++i) {
        var consent = user.instances[i].consent;
        if (consent.asClient == Consent.ClientState.GRANTED) {
          user.usesMe = true;
        }
        if (consent.asProxy == Consent.ProxyState.GRANTED) {
          user.givesMe = true;
        }
      }

      console.log('Synchronized user.', user);
    };
  }  // class UserInterface

}  // module UI
