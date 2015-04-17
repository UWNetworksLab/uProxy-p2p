/**
 * ui.ts
 *
 * Common User Interface state holder and changer.
 * TODO: firefox bindings.
 */
/// <reference path='user.ts' />
/// <reference path='core_connector.ts' />
/// <reference path='../../uproxy.ts'/>
/// <reference path='../../interfaces/ui.d.ts'/>
/// <reference path='../../interfaces/persistent.d.ts'/>
/// <reference path='../../interfaces/browser-api.d.ts'/>
/// <reference path='../../networking-typings/communications.d.ts' />

// Singleton model for data bindings.
var model :UI.Model = {
  networkNames: [],
  onlineNetwork: null,
  contacts: {
    getAccessContacts: {
      onlinePending: [],
      offlinePending: [],
      onlineTrustedUproxy: [],
      offlineTrustedUproxy: [],
      onlineUntrustedUproxy: [],
      offlineUntrustedUproxy: []
    },
    shareAccessContacts: {
      onlinePending: [],
      offlinePending: [],
      onlineTrustedUproxy: [],
      offlineTrustedUproxy: [],
      onlineUntrustedUproxy: [],
      offlineUntrustedUproxy: []
    }
  },
  globalSettings: {
    version: uProxy.STORAGE_VERSION,
    description: '',
    stunServers: [],
    hasSeenSharingEnabledScreen: false,
    hasSeenWelcome: false,
    mode : uProxy.Mode.GET,
    allowNonUnicast: false
  },
  reconnecting: false
};

// TODO: currently we have a UI object (typescript module, i.e. namespace)
// and a ui object (singleton intance of UI.UserInterface).  We should
// change the names of these to avoid confusion.
module UI {

  // Filenames for icons.
  // Two important things about using these strings:
  // 1) When updating the icon strings below, default values in the Chrome
  // manifests and Firefox main.js should also be changed to match.
  // 2) These are only the suffixes of the icon names. Because we have
  // different sizes of icons, the actual filenames have the dimension
  // as a prefix. E.g. "19_online.gif" for the 19x19 pixel version.

  // Icons for browser bar, also used for notifications.
  export var DEFAULT_ICON :string = 'online.gif';
  export var LOGGED_OUT_ICON :string = 'offline.gif';
  export var SHARING_ICON :string = 'sharing.gif';
  export var GETTING_ICON :string = 'getting.gif';
  export var ERROR_ICON :string = 'error.gif';
  export var GETTING_SHARING_ICON :string = 'gettingandsharing.gif';

  export var DEFAULT_USER_IMG = '../icons/contact-default.png';

  export var SHARE_FAILED_MSG :string = 'Unable to share access with ';
  export var GET_FAILED_MSG :string = 'Unable to get access from ';

  export interface Contacts {
    getAccessContacts : {
      onlinePending :UI.User[];
      offlinePending :UI.User[];
      onlineTrustedUproxy :UI.User[];
      offlineTrustedUproxy :UI.User[];
      onlineUntrustedUproxy :UI.User[];
      offlineUntrustedUproxy :UI.User[];
    };
    shareAccessContacts : {
      onlinePending :UI.User[];
      offlinePending :UI.User[];
      onlineTrustedUproxy :UI.User[];
      offlineTrustedUproxy :UI.User[];
      onlineUntrustedUproxy :UI.User[];
      offlineUntrustedUproxy :UI.User[];
    }
  }

  export interface Model {
    networkNames :string[];
    onlineNetwork :UI.Network;
    contacts :Contacts;
    globalSettings :Core.GlobalSettings;
    reconnecting :boolean;
  }

   export interface UserCategories {
     getTab :string;
     shareTab :string;
   }

  /**
   * Specific to one particular Social network.
   */
  export interface Network {
    name   :string;
    // TODO(salomegeo): Add more information about the user.
    userId :string;
    imageData ?:string;
    userName ?:string;
    roster :{ [userId:string] :User };
    hasContacts ?:boolean;
  }

  export interface NotificationData {
    mode :string;
    user :string;
    unique ?:string;
  }

  export enum CopyPasteError {
    NONE = 0,
    BAD_URL, // url is somehow invalid
    LOGGED_IN, // trying to copy+paste while logged in to a network
    UNEXPECTED, // received a url at an invalid time
    FAILED // something about the connection failed
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

    public view :uProxy.View;

    // Current state within the splash (onboarding).  Needs to be part
    // of the ui object so it can be saved/restored when popup closes and opens.
    public splashState :number = 0;

    // Instance you are getting access from.
    // Null if you are not getting access.
    private instanceGettingAccessFrom_ = null;

    // The instances you are giving access to.
    // Remote instances to add to this set are received in messages from Core.
    public instancesGivingAccessTo = {};

    private mapInstanceIdToUser_ :{[instanceId :string] :UI.User} = {};

    public gettingStatus :string = null;
    public sharingStatus :string = null;

    public copyPasteGettingState :GettingState = GettingState.NONE;
    public copyPasteSharingState :SharingState = SharingState.NONE;
    public copyPasteBytesSent :number = 0;
    public copyPasteBytesReceived :number = 0;

    public copyPasteError :CopyPasteError = CopyPasteError.NONE;
    public copyPasteGettingMessage :string = '';
    public copyPasteSharingMessage :string = '';

    public browser :string = '';

    // Changing this causes root.ts to fire a core-signal
    // with the new value.
    public signalToFire :string = '';

    public toastMessage :string = null;

    private isLogoutExpected_ :boolean = false;
    private reconnectInterval_ :number;

    // is a proxy currently set
    private proxySet_ :boolean = false;
    // Must be included in Chrome extension manifest's list of permissions.
    public AWS_FRONT_DOMAIN = 'https://a0.awsstatic.com/';

    /*
     * This is used to store the information for setting up a copy+paste
     * connection between establishing the connection and the user confirming
     * the start of proxying
     */
    public copyPastePendingEndpoint :Net.Endpoint = null;

    // TODO not needed, exists to handle typescript errors
    private core_ :CoreConnector = null;

    /**
     * UI must be constructed with hooks to Notifications and Core.
     * Upon construction, the UI installs update handlers on core.
     */
    constructor(
        public core   :CoreConnector,
        public browserApi :BrowserAPI) {
      // TODO: Determine the best way to describe view transitions.
      this.view = uProxy.View.SPLASH;  // Begin at the splash intro.
      this.core_ = core;

      // Attach handlers for UPDATES received from core.
      // TODO: Implement the rest of the fine-grained state updates.
      // (We begin with the simplest, total state update, above.)
      core.onUpdate(uProxy.Update.INITIAL_STATE, (state :Object) => {
        console.log('Received uProxy.Update.INITIAL_STATE:', state);
        model.networkNames = state['networkNames'];
        // TODO: Do not allow reassignment of globalSettings. Instead
        // write a 'syncGlobalSettings' function that iterates through
        // the values in state[globalSettings] and assigns the
        // individual values to model.globalSettings. This is required
        // because Polymer elements bound to globalSettings' values can
        // only react to updates to globalSettings and not reassignments.
        model.globalSettings = state['globalSettings'];
      });

      // Add or update the online status of a network.
      core.onUpdate(uProxy.Update.NETWORK, this.syncNetwork_);

      // Attach handlers for USER updates.
      core.onUpdate(uProxy.Update.USER_SELF, (payload :UI.UserMessage) => {
        // Instead of adding to the roster, update the local user information.
        console.log('uProxy.Update.USER_SELF:', payload);
        if (!model.onlineNetwork ||
            payload.network != model.onlineNetwork.name) {
          console.error('uProxy.Update.USER_SELF message for invalid network',
              payload.network);
          return;
        }
        var profile :UI.UserProfileMessage = payload.user;
        model.onlineNetwork.userId = profile.userId;
        model.onlineNetwork.imageData = profile.imageData;
        model.onlineNetwork.userName = profile.name;
      });
      core.onUpdate(uProxy.Update.USER_FRIEND, (payload :UI.UserMessage) => {
        console.log('uProxy.Update.USER_FRIEND:', payload);
        this.syncUser(payload);
      });

      core.onUpdate(uProxy.Update.MANUAL_NETWORK_OUTBOUND_MESSAGE,
                    (message :uProxy.Message) => {
        console.log('Manual network outbound message: ' +
                    JSON.stringify(message));
        // TODO: Display the message in the 'manual network' UI.
      });

      core.onUpdate(uProxy.Update.SIGNALLING_MESSAGE, (message :uProxy.Message) => {
        var data :uProxy.Message[] = [], str = '';

        switch (message.type) {
          case uProxy.MessageType.SIGNAL_FROM_CLIENT_PEER:
            str = this.copyPasteGettingMessage;
            break;
          case uProxy.MessageType.SIGNAL_FROM_SERVER_PEER:
            str = this.copyPasteSharingMessage;
            break;
        }

        if (str) {
          data = JSON.parse(atob(decodeURIComponent(str)));
        }

        data.push(message);

        str = encodeURIComponent(btoa(JSON.stringify(data)));

        // reverse of above switch (since I can't just use a reference)
        switch (message.type) {
          case uProxy.MessageType.SIGNAL_FROM_CLIENT_PEER:
            this.copyPasteGettingMessage = str;
            break;
          case uProxy.MessageType.SIGNAL_FROM_SERVER_PEER:
            this.copyPasteSharingMessage = str;
            break;
        }
      });

      // indicates the current getting connection has ended
      core.onUpdate(uProxy.Update.STOP_GETTING, (error :boolean) => {
        this.stopGettingInUiAndConfig(error);
      });

      // indicates we just started offering access through copy+paste
      core.onUpdate(uProxy.Update.START_GIVING, () => {
        if (!this.isGivingAccess()) {
          this.startGivingInUi();
        }
      });

      // indicates we just stopped offering access through copy+paste
      core.onUpdate(uProxy.Update.STOP_GIVING, () => {
        this.copyPasteSharingState = SharingState.NONE;
        if (!this.isGivingAccess()) {
          this.stopGivingInUi();
        }
      });

      // status of the current copy+paste connection
      core.onUpdate(uProxy.Update.STATE, (state) => {
        this.copyPasteGettingState = state.localGettingFromRemote;
        this.copyPasteSharingState = state.localSharingWithRemote;
        this.copyPasteBytesSent = state.bytesSent;
        this.copyPasteBytesReceived = state.bytesReceived;
      });

      core.onUpdate(uProxy.Update.STOP_GETTING_FROM_FRIEND,
          (data :any) => {
        if (data.instanceId === this.instanceGettingAccessFrom_) {
          this.stopGettingInUiAndConfig(data.error);
        } else {
          console.warn('Can\'t stop getting access from friend you were not ' +
              'already getting access from.');
        }
      });

      core.onUpdate(uProxy.Update.START_GIVING_TO_FRIEND,
          (instanceId :string) => {
        // TODO (lucyhe): Update instancesGivingAccessTo before calling
        // startGivingInUi so that isGiving() is updated as early as possible.
        if (!this.isGivingAccess()) {
          this.startGivingInUi();
        }
        this.instancesGivingAccessTo[instanceId] = true;
        this.updateSharingStatusBar_();

        var user = this.mapInstanceIdToUser_[instanceId];
        user.isGettingFromMe = true;
        this.showNotification(user.name + ' started proxying through you',
            { mode: 'share', user: user.userId });
      });

      core.onUpdate(uProxy.Update.STOP_GIVING_TO_FRIEND,
          (instanceId :string) => {
        var isGettingFromMe = false;
        var user = this.mapInstanceIdToUser_[instanceId];

        // only show a notification if we knew we were prokying
        if (typeof this.instancesGivingAccessTo[instanceId] !== 'undefined') {
          this.showNotification(user.name + ' stopped proxying through you',
              { mode: 'share', user: user.userId });
        }
        delete this.instancesGivingAccessTo[instanceId];
        if (!this.isGivingAccess()) {
          this.stopGivingInUi();
        }

        // Update user.isGettingFromMe
        for (var i = 0; i < user.allInstanceIds.length; ++i) {
          if (this.instancesGivingAccessTo[user.allInstanceIds[i]]) {
            isGettingFromMe = true;
            break;
          }
        }
        user.isGettingFromMe = isGettingFromMe;

        this.updateSharingStatusBar_();
      });

      core.onUpdate(uProxy.Update.FRIEND_FAILED_TO_GET, (nameOfFriend) => {
        // Setting this variable will toggle a paper-toast (in root.html)
        // to open.
        this.toastMessage = UI.SHARE_FAILED_MSG + nameOfFriend;
      });
    }

    // Because of an observer (in root.ts) watching the value of
    // signalToFire, this function simulates firing a core-signal
    // from the background page.
    public fireSignal = (signal :string) => {
      this.signalToFire = signal;
    }

    public showNotification = (text :string, data ?:NotificationData) => {
      data = data ? data : { mode: '', user: '' };
      // non-uniqu but existing tags prevent the notification from displaying in some cases
      data.unique = Math.floor(Math.random() * 1E10).toString();

      try {
        var tag = JSON.stringify(data);
      } catch (e) {
        console.error('Could not encode data to tag');
        tag = data.unique;
      }

      this.browserApi.showNotification(text, tag);
    }

    public handleNotificationClick = (tag :string) => {
      // we want to bring uProxy to the front regardless of the info
      this.browserApi.bringUproxyToFront();

      try {
        var data = JSON.parse(tag);

        if (data.user) {
          var contact = model.onlineNetwork.roster[data.user];
        }

        if (data.mode === 'get') {
          model.globalSettings.mode = uProxy.Mode.GET;
          this.core_.updateGlobalSettings(model.globalSettings);
          if (contact) {
            contact.getExpanded = true;
          }
        } else if (data.mode === 'share') {
          model.globalSettings.mode = uProxy.Mode.SHARE;
          this.core_.updateGlobalSettings(model.globalSettings);
          if (contact) {
            contact.shareExpanded = true;
          }
        }
      } catch (e) {
        console.warn('error getting information from notification tag');
      }
    }

    private updateGettingStatusBar_ = () => {
      // TODO: localize this.
      if (this.instanceGettingAccessFrom_) {
        this.gettingStatus = 'Getting access from ' +
            this.mapInstanceIdToUser_[this.instanceGettingAccessFrom_].name;
      } else {
        this.gettingStatus = null;
      }
    }

    private updateSharingStatusBar_ = () => {
      // TODO: localize this - may require simpler formatting to work
      // in all languages.
      var instanceIds = Object.keys(this.instancesGivingAccessTo);
      if (instanceIds.length === 0) {
        this.sharingStatus = null;
      } else if (instanceIds.length === 1) {
        this.sharingStatus = 'Sharing access with ' +
            this.mapInstanceIdToUser_[instanceIds[0]].name;
      } else if (instanceIds.length === 2) {
        this.sharingStatus = 'Sharing access with ' +
            this.mapInstanceIdToUser_[instanceIds[0]].name + ' and ' +
            this.mapInstanceIdToUser_[instanceIds[1]].name;
      } else {
        this.sharingStatus = 'Sharing access with ' +
            this.mapInstanceIdToUser_[instanceIds[0]].name + ' and ' +
            (instanceIds.length - 1) + ' others';
      }
    }

    public handleUrlData = (url :string) => {
      var payload :uProxy.Message[];
      var expectedType :uProxy.MessageType;
      console.log('received url data from browser');

      if (model.onlineNetwork) {
        console.log('Ignoring URL since we have an active network');
        this.copyPasteError = CopyPasteError.LOGGED_IN;
        return;
      }

      this.view = uProxy.View.COPYPASTE;

      var match = url.match(/https:\/\/www.uproxy.org\/(request|offer)\/(.*)/)
      if (!match) {
        console.error('parsed url that did not match');
        this.copyPasteError = CopyPasteError.BAD_URL;
        return;
      }

      this.copyPasteError = CopyPasteError.NONE;
      try {
        payload = JSON.parse(atob(decodeURIComponent(match[2])));
      } catch (e) {
        console.error('malformed string from browser');
        this.copyPasteError = CopyPasteError.BAD_URL;
        return;
      }

      if (SharingState.NONE !== this.copyPasteSharingState) {
        console.info('should not be processing a URL while in the middle of sharing');
        this.copyPasteError = CopyPasteError.UNEXPECTED;
        return;
      }

      // at this point, we assume everything is good, so let's check state
      switch (match[1]) {
        case 'request':
          expectedType = uProxy.MessageType.SIGNAL_FROM_CLIENT_PEER;
          this.copyPasteSharingMessage = '';
          this.core_.startCopyPasteShare();
          break;
        case 'offer':
          expectedType = uProxy.MessageType.SIGNAL_FROM_SERVER_PEER;
          if (GettingState.TRYING_TO_GET_ACCESS !== this.copyPasteGettingState) {
            console.warn('currently not expecting any information, aborting');
            this.copyPasteError = CopyPasteError.UNEXPECTED;
            return;
          }
          break;
      }

      console.log('Sending messages from url to app');
      for (var i in payload) {
        if (payload[i].type !== expectedType) {
          this.copyPasteError = CopyPasteError.BAD_URL;
          return;
        }

        this.core_.sendCopyPasteSignal(payload[i]);
      }
    }

    /**
     * Removes proxy indicators from UI and undoes proxy configuration
     * (e.g. chrome.proxy settings).
     * If user didn't end proxying, so if proxy session ended because of some
     * unexpected reason, user should be asked before reverting proxy settings.
     */
    public stopGettingInUiAndConfig = (askUser :boolean) => {
      var instanceId = this.instanceGettingAccessFrom_;
      this.instanceGettingAccessFrom_ = null;

      if (this.isGivingAccess()) {
        this.browserApi.setIcon(UI.SHARING_ICON);
      } else if (model.onlineNetwork) {
        this.browserApi.setIcon(UI.DEFAULT_ICON);
      } else {
        this.setOfflineIcon();
      }

      this.updateGettingStatusBar_();

      if (instanceId) {
        this.mapInstanceIdToUser_[instanceId].isSharingWithMe = false;
      }

      if (askUser) {
        this.browserApi.setIcon(UI.ERROR_ICON);
        this.browserApi.launchTabIfNotOpen('disconnected.html');
        return;
      }

      this.proxySet_ = false;
      this.browserApi.stopUsingProxy();
    }

    public startGettingInUi = () => {
      if (this.isGivingAccess()) {
        this.browserApi.setIcon(UI.GETTING_SHARING_ICON);
      } else {
        this.browserApi.setIcon(UI.GETTING_ICON);
      }
    }

    /**
      * Sets extension icon to default and undoes proxy configuration.
      */
    public startGettingInUiAndConfig =
        (instanceId :string, endpoint :Net.Endpoint) => {
      if (instanceId) {
        this.instanceGettingAccessFrom_ = instanceId;
        this.mapInstanceIdToUser_[instanceId].isSharingWithMe = true;
      }

      this.startGettingInUi();

      this.updateGettingStatusBar_();

      if (this.proxySet_) {
        // this handles the case where the user starts proxying again before
        // confirming the disconnect
        this.stopGettingInUiAndConfig(false);
      }

      this.proxySet_ = true;
      this.browserApi.startUsingProxy(endpoint);
    }

    /**
      * Set extension icon to the 'giving' icon.
      */
    public startGivingInUi = () => {
      if (this.isGettingAccess()) {
        this.browserApi.setIcon(UI.GETTING_SHARING_ICON);
      } else {
        this.browserApi.setIcon(UI.SHARING_ICON);
      }
    }

    /**
      * Set extension icon to the default icon.
      */
    public stopGivingInUi = () => {
      if (this.isGettingAccess()) {
        this.browserApi.setIcon(UI.GETTING_ICON);
      } else if (model.onlineNetwork) {
        this.browserApi.setIcon(UI.DEFAULT_ICON);
      } else {
        this.setOfflineIcon();
      }
    }

    public setOfflineIcon = () => {
      this.browserApi.setIcon(UI.LOGGED_OUT_ICON);
    }

    public isGettingAccess = () => {
      return this.instanceGettingAccessFrom_ != null;
    }

    public isGivingAccess = () => {
      return Object.keys(this.instancesGivingAccessTo).length > 0 ||
             this.copyPasteSharingState === SharingState.SHARING_ACCESS;
    }

    /**
     * Synchronize a new network to be visible on this UI.
     */
    private syncNetwork_ = (network :UI.NetworkMessage) => {
      console.log('uProxy.Update.NETWORK', network);
      console.log('model: ', model);

      // If you are now online (on a non-manual network), and were
      // previously offline, show the default (logo) icon.
      if (network.online && network.name != 'Manual'
          && model.onlineNetwork == null) {
        this.browserApi.setIcon(UI.DEFAULT_ICON);
      }

      if (model.onlineNetwork &&
          (network.online && network.name != model.onlineNetwork.name) ||
          (!network.online && network.name == model.onlineNetwork.name)) {
        // onlineNetwork exists and has either been changed or logged out.
        // Clear roster and option user info from offline network.
        for (var userId in model.onlineNetwork.roster) {
          var user = model.onlineNetwork.roster[userId];
          var userCategories = user.getCategories();
          this.categorizeUser_(user, model.contacts.getAccessContacts,
              userCategories.getTab, null);
          this.categorizeUser_(user, model.contacts.shareAccessContacts,
              userCategories.shareTab, null);
        }
        this.setOfflineIcon();
        model.onlineNetwork = null;

        if (!this.isLogoutExpected_ && !network.online &&
            this.browser == 'chrome') {
          console.warn('Unexpected logout, reconnecting to ' + network.name);
          this.reconnect(network.name);
        } else {
          this.showNotification('You have been logged out of ' + network.name);
          this.view = uProxy.View.SPLASH;
        }
      }

      if (network.online && !model.onlineNetwork) {
        model.onlineNetwork = {
          name:   network.name,
          userId: network.userId,
          roster: {},
          hasContacts: false
        };
      }
    }

    // Synchronize the data about the current user.
    // TODO: Be able to sync local instance, per network.

    /**
     * Synchronize data about some friend.
     */
    public syncUser = (payload :UI.UserMessage) => {
      if (!model.onlineNetwork || model.onlineNetwork.name != payload.network) {
        // Ignore all user updates when the network is offline.
        // These user updates may come in asynchrously after logging out of a
        // network, e.g. if the UI logs out of Google while we are getting
        // access, we will first completely logout and then asynchronously
        // get an update for the user when the peerconnection has closed - in
        // this case the user should already have been removed from the roster
        // in the UI and stay removed.
        return;
      }

      // Construct a UI-specific user object.
      var profile = payload.user;
      // Update / create if necessary a user, both in the network-specific
      // roster and the global roster.
      var user :UI.User;
      user = model.onlineNetwork.roster[profile.userId];
      var oldUserCategories = {getTab: null, shareTab: null};

      if (!user) {
        // New user.
        user = new UI.User(profile.userId, model.onlineNetwork, this);
        model.onlineNetwork.roster[profile.userId] = user;
        model.onlineNetwork.hasContacts = true;
      } else {
        // Existing user, get the category before modifying any properties.
        oldUserCategories = user.getCategories();
      }

      user.update(payload);

      for (var i = 0; i < payload.allInstanceIds.length; ++i) {
        this.mapInstanceIdToUser_[payload.allInstanceIds[i]] = user;
      }

      var newUserCategories = user.getCategories();
      // Update the user's category in both get and share tabs.
      this.categorizeUser_(user, model.contacts.getAccessContacts,
          oldUserCategories.getTab, newUserCategories.getTab);
      this.categorizeUser_(user, model.contacts.shareAccessContacts,
          oldUserCategories.shareTab, newUserCategories.shareTab);

      console.log('Synchronized user.', user);
    };

    private categorizeUser_ = (user, contacts, oldCategory, newCategory) => {
      if (oldCategory == null) {
        // User hasn't yet been categorized.
        contacts[newCategory].push(user);
      } else if (oldCategory != newCategory) {
        // Remove user from old category.
        var oldCategoryArray = contacts[oldCategory];
        for (var i = 0; i < oldCategoryArray.length; ++i) {
          if (oldCategoryArray[i] == user) {
            oldCategoryArray.splice(i, 1);
            break;
          }
        }
        // Add users to new category.
        if (newCategory) {
          contacts[newCategory].push(user);
        }
      }
    }

    public openTab = (url :string) => {
      this.browserApi.openTab(url);
    }

    public bringUproxyToFront = () => {
      this.browserApi.bringUproxyToFront();
    }

    public login = (network :string) : Promise<void> => {
      this.isLogoutExpected_ = false;
      return this.core.login(network);
    }

    public logout = (networkInfo :NetworkInfo) : Promise<void> => {
      this.isLogoutExpected_ = true;
      return this.core.logout(networkInfo);
    }

    public reconnect = (network :string) => {
      // TODO: this reconnect logic has some issues:
      // 1. It only attempts to re-use the last access_token, and doesn't
      //    use refresh_tokens to get a new access_token when they expire.
      // 2. It only works for Chrome, as only Chrome has a custom OAuth provider
      //    that supports the model.reconnecting variable
      // See https://docs.google.com/document/d/1COT5YcXWg-jUnD59v0JHcYepMdQCIanKO_xfuq2bY48
      // for a proposed design on making this better
      model.reconnecting = true;

      var ping = () : Promise<void> => {
        var pingUrl = network == 'Facebook'
            ? 'https://graph.facebook.com' : 'https://www.googleapis.com';
        return new Promise<void>(function(F, R) {
          var xhr = new XMLHttpRequest();
          xhr.open('GET', pingUrl);
          xhr.onload = function() { F(); };
          xhr.onerror = function() { R(new Error('Ping failed')); };
          xhr.send();
        });
      }

      var loginCalled = false;
      var attemptReconnect = () => {
        ping().then(() => {
          // Ensure that we only call login once.  This is needed in case
          // either login or the ping takes too long and we accidentally
          // call login twice.  Doing so would cause one of the login
          // calls to fail, resulting in the user seeing the splash page.
          if (!loginCalled) {
            loginCalled = true;
            this.core.login(network).then(() => {
              // Successfully reconnected, stop additional reconnect attempts.
              this.stopReconnect();
            }).catch((e) => {
              // Login with last oauth token failed, give up on reconnect.
              this.stopReconnect();
              this.showNotification('You have been logged out of ' + network);
              this.view = uProxy.View.SPLASH;
            });
          }
        }).catch((e) => {
          // Ping failed, we will try again on the next interval.
        });
      };

      // Call attemptReconnect immediately and every 10 seconds afterwards
      // until it is successful.
      this.reconnectInterval_ = setInterval(attemptReconnect, 10000);
      attemptReconnect();
    }

    public stopReconnect = () => {
      model.reconnecting = false;
      if (this.reconnectInterval_) {
        clearInterval(this.reconnectInterval_);
        this.reconnectInterval_ = null;
      }
    }

    private cloudfrontDomains_ = [
      "d1wtwocg4wx1ih.cloudfront.net"
    ]

    public sendFeedback = (feedback :uProxy.UserFeedback, maxAttempts?:number) : Promise<void> => {
      if (!maxAttempts || maxAttempts > this.cloudfrontDomains_.length) {
        // default to trying every possible URL
        maxAttempts = this.cloudfrontDomains_.length;
      }

      var logsPromise :Promise<string>;

      if (feedback.logs) {
        logsPromise = this.core.getLogs().then((logs) => {
          var browserInfo = 'Browser Info: ' + feedback.browserInfo + '\n\n';
          return browserInfo + logs;
        });
      } else {
        logsPromise = Promise.resolve('');
      }

      return logsPromise.then((logs) => {
        var attempts = 0;

        var payload = {
          email: feedback.email,
          feedback: feedback.feedback,
          logs: logs
        };

        var doAttempts = (error?:Error) => {
          if (attempts < maxAttempts) {
            // we want to keep trying this until we either run out of urls to
            // send to or one of the requests succeeds.  We set this up by
            // creating a lambda to call the post with failures set up to recurse
            return this.browserApi.frontedPost(payload, this.AWS_FRONT_DOMAIN,
              this.cloudfrontDomains_[attempts++], "submit-feedback"
            ).catch(doAttempts);
          }

          throw error;
        }

        return doAttempts();
      });
    }
  }  // class UserInterface

}  // module UI
