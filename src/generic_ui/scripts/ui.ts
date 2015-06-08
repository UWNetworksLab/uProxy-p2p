/// <reference path='../../../../third_party/typings/i18next/i18next.d.ts' />

/**
 * ui.ts
 *
 * Common User Interface state holder and changer.
 * TODO: firefox bindings.
 */

import ui_constants = require('../../interfaces/ui');
import Persistent = require('../../interfaces/persistent');
import CoreConnector = require('./core_connector');
import uproxy_core_api = require('../../interfaces/uproxy_core_api');
import browser_api = require('../../interfaces/browser_api');
import BrowserAPI = browser_api.BrowserAPI;
import net = require('../../../../third_party/uproxy-lib/net/net.types');
import noreConnector = require('./core_connector');
import user_module = require('./user');
import User = user_module.User;
import social = require('../../interfaces/social');
import translator_module = require('./translator');
import _ = require('lodash');

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

export var DEFAULT_USER_IMG = 'icons/contact-default.png';

export class Model {
  public networkNames :string[] = [];

  public onlineNetworks :Network[] = [];

  public contacts :Contacts = {
    getAccessContacts: {
      pending: [],
      trustedUproxy: [],
      untrustedUproxy: [],
    },
    shareAccessContacts: {
      pending: [],
      trustedUproxy: [],
      untrustedUproxy: [],
    }
  };

  public globalSettings :uproxy_core_api.GlobalSettings = {
    version: 0,
    description: '',
    stunServers: [],
    hasSeenSharingEnabledScreen: false,
    hasSeenWelcome: false,
    mode : ui_constants.Mode.GET,
    allowNonUnicast: false,
    statsReportingEnabled: false,
    consoleFilter: 2, // loggingTypes.Level.warn
    language: 'en-US'
  };

  public reconnecting = false;

  // userId is included as an optional parameter because we will eventually
  // want to use it to get an accurate network.  For now, it is ignored and
  // serves to remind us of where we still need to add the info
  public getNetwork = (networkName :string, userId?:string) :Network => {
    return _.find(this.onlineNetworks, { name: networkName });
  }

  public removeNetwork = (networkName :string) => {
    _.remove(this.onlineNetworks, { name: networkName });
  }

  public getUser = (network :Network, userId :string) :User => {
    if (network.roster[userId]) {
      return network.roster[userId];
    }

    return null;
  }
}

// Singleton model for data bindings.
export var model = new Model();

export interface ContactCategory {
  [type :string] :User[];
  pending :User[];
  trustedUproxy :User[];
  untrustedUproxy :User[];
}

export interface Contacts {
  getAccessContacts :ContactCategory;
  shareAccessContacts :ContactCategory;
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
  logoutExpected: boolean;
  roster :{ [userId:string] :User };
}

export interface NotificationData {
  mode :string;
  network :string;
  user :string;
  unique ?:string;
}

/**
 * The User Interface class.
 *
 * Keeps persistent state between the popup opening and closing.
 * Manipulates the payloads received from UPDATES from the Core in preparation
 * for UI interaction.
 * Any COMMANDs from the UI should be directly called from the 'core' object.
 */
export class UserInterface implements ui_constants.UiApi {
  public DEBUG = false;  // Set to true to show the model in the UI.

  public view :ui_constants.View;

  // Current state within the splash (onboarding).  Needs to be part
  // of the ui object so it can be saved/restored when popup closes and opens.
  public splashState :number = 0;

  // Instance you are getting access from.
  // Null if you are not getting access.
  public instanceTryingToGetAccessFrom :string = null;
  private instanceGettingAccessFrom_ :string = null;

  // The instances you are giving access to.
  // Remote instances to add to this set are received in messages from Core.
  public instancesGivingAccessTo :{[instanceId :string] :boolean} = {};

  private mapInstanceIdToUser_ :{[instanceId :string] :User} = {};

  public gettingStatus :string = null;
  public sharingStatus :string = null;

  public copyPasteGettingState :social.GettingState = social.GettingState.NONE;
  public copyPasteSharingState :social.SharingState = social.SharingState.NONE;
  public copyPasteBytesSent :number = 0;
  public copyPasteBytesReceived :number = 0;

  public copyPasteError :ui_constants.CopyPasteError = ui_constants.CopyPasteError.NONE;
  public copyPasteGettingMessage :string = '';
  public copyPasteSharingMessage :string = '';

  public browser :string = '';

  // Changing this causes root.ts to fire a core-signal
  // with the new value.
  public signalToFire :string = '';

  public toastMessage :string = null;
  public unableToGet :boolean = false;
  public unableToShare :boolean = false;

  // is a proxy currently set
  private proxySet_ :boolean = false;
  // Must be included in Chrome extension manifest's list of permissions.
  public AWS_FRONT_DOMAIN = 'https://a0.awsstatic.com/';

  /*
   * This is used to store the information for setting up a copy+paste
   * connection between establishing the connection and the user confirming
   * the start of proxying
   */
  public copyPastePendingEndpoint :net.Endpoint = null;

  public isSharingDisabled = false;

  public disconnectedWhileProxying = false;

  public i18n_t :Function = translator_module.i18n_t;
  public i18n_setLng :Function = translator_module.i18n_setLng;

  /**
   * UI must be constructed with hooks to Notifications and Core.
   * Upon construction, the UI installs update handlers on core.
   */
  constructor(
      public core   :CoreConnector,
      public browserApi :BrowserAPI) {
    // TODO: Determine the best way to describe view transitions.
    this.view = ui_constants.View.SPLASH;  // Begin at the splash intro.
    this.i18n_setLng(model.globalSettings.language);

    var firefoxMatches = navigator.userAgent.match(/Firefox\/(\d+)/);
    if (firefoxMatches) {
      if (parseInt(firefoxMatches[1], 10) === 37) {
        this.isSharingDisabled = true;
      }
    }

    core.on('core_connect', () => {
      this.view = ui_constants.View.SPLASH;

      core.getFullState()
          .then(this.updateInitialState);
    });

    core.on('core_disconnect', () => {
      // When disconnected from the app, we should show the browser specific page
      // that shows the "app missing" message.
      this.view = ui_constants.View.BROWSER_ERROR;

      if (this.isGettingAccess()) {
        this.stopGettingInUiAndConfig(true);
      }
    });

    core.connect();

    core.onUpdate(uproxy_core_api.Update.INITIAL_STATE_DEPRECATED_0_8_10, this.updateInitialState);

    // Add or update the online status of a network.
    core.onUpdate(uproxy_core_api.Update.NETWORK, this.syncNetwork_);

    // Attach handlers for USER updates.
    core.onUpdate(uproxy_core_api.Update.USER_SELF, this.syncUserSelf_);

    core.onUpdate(uproxy_core_api.Update.USER_FRIEND, this.syncUser);

    core.onUpdate(uproxy_core_api.Update.MANUAL_NETWORK_OUTBOUND_MESSAGE,
                  (message :social.PeerMessage) => {
      console.log('Manual network outbound message: ' +
                  JSON.stringify(message));
      // TODO: Display the message in the 'manual network' UI.
    });

    core.onUpdate(uproxy_core_api.Update.SIGNALLING_MESSAGE, (message :social.PeerMessage) => {
      var data :social.PeerMessage[] = [], str = '';

      switch (message.type) {
        case social.PeerMessageType.SIGNAL_FROM_CLIENT_PEER:
          str = this.copyPasteGettingMessage;
          break;
        case social.PeerMessageType.SIGNAL_FROM_SERVER_PEER:
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
        case social.PeerMessageType.SIGNAL_FROM_CLIENT_PEER:
          this.copyPasteGettingMessage = str;
          break;
        case social.PeerMessageType.SIGNAL_FROM_SERVER_PEER:
          this.copyPasteSharingMessage = str;
          break;
      }
    });

    // indicates the current getting connection has ended
    core.onUpdate(uproxy_core_api.Update.STOP_GETTING, (error :boolean) => {
      this.stopGettingInUiAndConfig(error);
    });

    // indicates we just started offering access through copy+paste
    core.onUpdate(uproxy_core_api.Update.START_GIVING, () => {
      if (!this.isGivingAccess()) {
        this.startGivingInUi();
      }
    });

    // indicates we just stopped offering access through copy+paste
    core.onUpdate(uproxy_core_api.Update.STOP_GIVING, () => {
      this.copyPasteSharingState = social.SharingState.NONE;
      if (!this.isGivingAccess()) {
        this.stopGivingInUi();
      }
    });

    // status of the current copy+paste connection
    core.onUpdate(uproxy_core_api.Update.STATE, (state :uproxy_core_api.ConnectionState) => {
      this.copyPasteGettingState = state.localGettingFromRemote;
      this.copyPasteSharingState = state.localSharingWithRemote;
      this.copyPasteBytesSent = state.bytesSent;
      this.copyPasteBytesReceived = state.bytesReceived;
    });

    core.onUpdate(uproxy_core_api.Update.STOP_GETTING_FROM_FRIEND,
        (data :any) => { // TODO better type
      if (data.instanceId === this.instanceGettingAccessFrom_) {
        this.stopGettingInUiAndConfig(data.error);
      } else {
        console.warn('Can\'t stop getting access from friend you were not ' +
            'already getting access from.');
      }
    });

    core.onUpdate(uproxy_core_api.Update.START_GIVING_TO_FRIEND,
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
      this.showNotification(this.i18n_t('startedProxying',
          { name: user.name }), { mode: 'share', network: user.network.name, user: user.userId });
    });

    core.onUpdate(uproxy_core_api.Update.STOP_GIVING_TO_FRIEND,
        (instanceId :string) => {
      var isGettingFromMe = false;
      var user = this.mapInstanceIdToUser_[instanceId];

      // only show a notification if we knew we were prokying
      if (typeof this.instancesGivingAccessTo[instanceId] !== 'undefined') {
        this.showNotification(this.i18n_t('stoppedProxying',
          { name: user.name }), { mode: 'share', network: user.network.name, user: user.userId });
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

    core.onUpdate(uproxy_core_api.Update.FRIEND_FAILED_TO_GET, (nameOfFriend :string) => {
      // Setting this variable will toggle a paper-toast (in root.html)
      // to open.
      this.toastMessage =
          this.i18n_t('unableToShareWith', { name: nameOfFriend });
      this.unableToShare = true;
    });

    core.onUpdate(
        uproxy_core_api.Update.POST_TO_CLOUDFRONT,
        (data :uproxy_core_api.CloudfrontPostData) => {
      this.postToCloudfrontSite(data.payload, data.cloudfrontPath);
    });

    browserApi.on('urlData', this.handleUrlData);
    browserApi.on('notificationClicked', this.handleNotificationClick);
    browserApi.on('proxyDisconnected', this.proxyDisconnected);
  }

  // Because of an observer (in root.ts) watching the value of
  // signalToFire, this function simulates firing a core-signal
  // from the background page.
  public fireSignal = (signal :string) => {
    this.signalToFire = signal;
  }

  public showNotification = (text :string, data ?:NotificationData) => {
    data = data ? data : { mode: '', network: '', user: '' };
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

      if (data.network && data.user) {
        var network = model.getNetwork(data.network);
        if (network) {
          var contact = model.getUser(network, data.user);
        }
      }

      if (data.mode === 'get') {
        model.globalSettings.mode = ui_constants.Mode.GET;
        this.core.updateGlobalSettings(model.globalSettings);
        if (contact) {
          contact.getExpanded = true;
        }
      } else if (data.mode === 'share' && !this.isSharingDisabled) {
        model.globalSettings.mode = ui_constants.Mode.SHARE;
        this.core.updateGlobalSettings(model.globalSettings);
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
      this.gettingStatus = this.i18n_t('gettingAccessFrom', {
        name: this.mapInstanceIdToUser_[this.instanceGettingAccessFrom_].name
      });
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
      this.sharingStatus = this.i18n_t('sharingAccessWith_one', {
        name: this.mapInstanceIdToUser_[instanceIds[0]].name
      });
    } else if (instanceIds.length === 2) {
      this.sharingStatus = this.i18n_t('sharingAccessWith_two', {
        name1: this.mapInstanceIdToUser_[instanceIds[0]].name,
        name2: this.mapInstanceIdToUser_[instanceIds[1]].name
      });
    } else {
      this.sharingStatus = this.i18n_t('sharingAccessWith_two', {
        name: this.mapInstanceIdToUser_[instanceIds[0]].name,
        numOthers: (instanceIds.length - 1)
      });
    }
  }

  public handleUrlData = (url :string) => {
    var payload :social.PeerMessage[];
    var expectedType :social.PeerMessageType;
    console.log('received url data from browser');

    if (model.onlineNetworks.length > 0) {
      console.log('Ignoring URL since we have an active network');
      this.copyPasteError = ui_constants.CopyPasteError.LOGGED_IN;
      return;
    }

    this.view = ui_constants.View.COPYPASTE;

    var match = url.match(/https:\/\/www.uproxy.org\/(request|offer)\/(.*)/)
    if (!match) {
      console.error('parsed url that did not match');
      this.copyPasteError = ui_constants.CopyPasteError.BAD_URL;
      return;
    }

    this.copyPasteError = ui_constants.CopyPasteError.NONE;
    try {
      payload = JSON.parse(atob(decodeURIComponent(match[2])));
    } catch (e) {
      console.error('malformed string from browser');
      this.copyPasteError = ui_constants.CopyPasteError.BAD_URL;
      return;
    }

    if (social.SharingState.NONE !== this.copyPasteSharingState) {
      console.info('should not be processing a URL while in the middle of sharing');
      this.copyPasteError = ui_constants.CopyPasteError.UNEXPECTED;
      return;
    }

    // at this point, we assume everything is good, so let's check state
    switch (match[1]) {
      case 'request':
        expectedType = social.PeerMessageType.SIGNAL_FROM_CLIENT_PEER;
        this.copyPasteSharingMessage = '';
        this.core.startCopyPasteShare();
        break;
      case 'offer':
        expectedType = social.PeerMessageType.SIGNAL_FROM_SERVER_PEER;
        if (social.GettingState.TRYING_TO_GET_ACCESS !== this.copyPasteGettingState) {
          console.warn('currently not expecting any information, aborting');
          this.copyPasteError = ui_constants.CopyPasteError.UNEXPECTED;
          return;
        }
        break;
    }

    console.log('Sending messages from url to app');
    for (var i in payload) {
      if (payload[i].type !== expectedType) {
        this.copyPasteError = ui_constants.CopyPasteError.BAD_URL;
        return;
      }

      this.core.sendCopyPasteSignal(payload[i]);
    }
  }

  public proxyDisconnected = () => {
    if (this.isGettingAccess()) {
      this.stopGettingFromInstance(this.instanceGettingAccessFrom_);
      this.fireSignal('open-proxy-error');
      this.bringUproxyToFront();
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

    this.updateIcon_();
    this.updateGettingStatusBar_();

    if (instanceId) {
      this.mapInstanceIdToUser_[instanceId].isSharingWithMe = false;
    }

    if (askUser) {
      this.disconnectedWhileProxying = true;
      this.updateIcon_();
      this.bringUproxyToFront();
      return;
    }

    this.disconnectedWhileProxying = false;
    this.proxySet_ = false;
    this.browserApi.stopUsingProxy();
  }

  public startGettingFromInstance = (instanceId :string) :Promise<void> => {
    var user = this.mapInstanceIdToUser_[instanceId];

    var path = <social.InstancePath>{
      network: {
        name: user.network.name,
        userId: user.network.userId
      },
      userId: user.userId,
      instanceId: instanceId
    };

    this.instanceTryingToGetAccessFrom = instanceId;

    return this.core.start(path).then((endpoint :net.Endpoint) => {
      this.instanceTryingToGetAccessFrom = null;

      this.startGettingInUiAndConfig(instanceId, endpoint);
    }).catch((e :Error) => {
      // this is only an error if we are still trying to get access from the
      // instance
      if (this.instanceTryingToGetAccessFrom !== instanceId) {
        return;
      }

      this.toastMessage = this.i18n_t('unableToGetFrom', { name: user.name });
      this.unableToGet = true;
      this.bringUproxyToFront();
      return Promise.reject(e);
    });
  }

  public stopGettingFromInstance = (instanceId :string) :void => {
    if (instanceId === this.instanceTryingToGetAccessFrom) {
      // aborting pending connection
      this.instanceTryingToGetAccessFrom = null;
    } else if (instanceId === this.instanceGettingAccessFrom_) {
      // instance will be unset in eventual callback from core
    } else {
      // we have no idea what's going on
      console.error('Attempting to stop getting from unknown instance');
    }

    this.core.stop();
  }

  public startGettingInUi = () => {
    this.updateIcon_(true);
  }

  /**
    * Sets extension icon to default and undoes proxy configuration.
    */
  public startGettingInUiAndConfig =
      (instanceId :string, endpoint :net.Endpoint) => {
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
    this.updateIcon_(null, true);
  }

  private updateIcon_ = (isGetting?:boolean, isGiving?:boolean) => {
    if (isGetting === null || typeof isGetting === 'undefined') {
      isGetting = this.isGettingAccess();
    }

    if (isGiving === null || typeof isGiving === 'undefined') {
      isGiving = this.isGivingAccess();
    }

    if (this.disconnectedWhileProxying) {
      this.browserApi.setIcon(ERROR_ICON);
    } else if (isGetting && isGiving) {
      this.browserApi.setIcon(GETTING_SHARING_ICON);
    } else if (isGetting) {
      this.browserApi.setIcon(GETTING_ICON);
    } else if (isGiving) {
      this.browserApi.setIcon(SHARING_ICON);
    } else if (model.onlineNetworks.length > 0) {
      this.browserApi.setIcon(DEFAULT_ICON);
    } else {
      this.browserApi.setIcon(LOGGED_OUT_ICON);
    }
  }

  /**
    * Set extension icon to the default icon.
    */
  public stopGivingInUi = () => {
    this.updateIcon_(null, false);
  }

  public isGettingAccess = () => {
    return this.instanceGettingAccessFrom_ != null;
  }

  public isGivingAccess = () => {
    return Object.keys(this.instancesGivingAccessTo).length > 0 ||
           this.copyPasteSharingState === social.SharingState.SHARING_ACCESS;
  }

  /**
   * Synchronize a new network to be visible on this UI.
   */
  private syncNetwork_ = (networkMsg :social.NetworkMessage) => {
    var existingNetwork = model.getNetwork(networkMsg.name, networkMsg.userId);

    if (networkMsg.online) {
      if (!existingNetwork) {
        existingNetwork = {
          name: networkMsg.name,
          userId: networkMsg.userId,
          roster: {},
          logoutExpected: false
        };
        model.onlineNetworks.push(existingNetwork);
      }
    } else {
      if (existingNetwork) {
        for (var userId in existingNetwork.roster) {
          var user = existingNetwork.roster[userId];
          var userCategories = user.getCategories();
          this.categorizeUser_(user, model.contacts.getAccessContacts,
                               userCategories.getTab, null);
          this.categorizeUser_(user, model.contacts.shareAccessContacts,
                               userCategories.shareTab, null);
        }
        model.removeNetwork(networkMsg.name);

        if (!existingNetwork.logoutExpected && networkMsg.name === 'Google' &&
            !this.disconnectedWhileProxying && !this.instanceGettingAccessFrom_) {
          console.warn('Unexpected logout, reconnecting to ' + networkMsg.name);
          this.reconnect(networkMsg.name);
        } else {
          if (this.instanceGettingAccessFrom_) {
            this.stopGettingInUiAndConfig(true);
          }
          this.showNotification(this.i18n_t('loggedOut', {network: networkMsg.name}));

          if (!model.onlineNetworks.length) {
            this.view = ui_constants.View.SPLASH;
          }
        }
      }
    }

    this.updateIcon_();
  }

  private syncUserSelf_ = (payload :social.UserData) => {
    var network = model.getNetwork(payload.network);
    if (!network) {
      console.error('uproxy_core_api.Update.USER_SELF message for invalid network',
          payload.network);
      return;
    }
    var profile :social.UserProfileMessage = payload.user;
    network.userId = profile.userId;
    network.imageData = profile.imageData;
    network.userName = profile.name;
  }

  /**
   * Synchronize data about some friend.
   */
  public syncUser = (payload :social.UserData) => {
    var network = model.getNetwork(payload.network);
    if (!network) {
       return;
    }

    // Construct a UI-specific user object.
    var profile = payload.user;
    // Update / create if necessary a user, both in the network-specific
    // roster and the global roster.
    var user :User;
    user = model.getUser(network, profile.userId);
    var oldUserCategories :UserCategories = {
      getTab: null,
      shareTab: null
    };

    if (!user) {
      // New user.
      user = new User(profile.userId, network, this);
      network.roster[profile.userId] = user;
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

  private categorizeUser_ = (user :User, contacts :ContactCategory, oldCategory :string, newCategory :string) => {
    if (oldCategory === newCategory) {
      // no need to do any work if nothing changed
      return;
    }

    if (oldCategory) {
      // remove user from old category
      var oldCategoryArray = contacts[oldCategory];
      for (var i = 0; i < oldCategoryArray.length; ++i) {
        if (oldCategoryArray[i] == user) {
          oldCategoryArray.splice(i, 1);
          break;
        }
      }
    }

    if (newCategory) {
      // add user to new category
      contacts[newCategory].push(user);
    }
  }

  public openTab = (url :string) => {
    this.browserApi.openTab(url);
  }

  public bringUproxyToFront = () => {
    this.browserApi.bringUproxyToFront();
  }

  public login = (network :string) : Promise<void> => {
    return this.core.login({network: network, reconnect: false});
  }

  public logout = (networkInfo :social.SocialNetworkInfo) : Promise<void> => {
    var network = model.getNetwork(networkInfo.name);
    if (network) {
      // if we know about the network, record that we expect this logout to
      // happen
      network.logoutExpected = true;
    } else {
      console.warn('User is trying to log out of not-logged-in-network ' +
                   networkInfo.name);
    }

    return this.core.logout(networkInfo);
  }

  public reconnect = (network :string) => {
    model.reconnecting = true;
    var pingUrl = network == 'Facebook'
        ? 'https://graph.facebook.com' : 'https://www.googleapis.com';
    this.core.pingUntilOnline(pingUrl).then(() => {
      // Ensure that the user is still attempting to reconnect (i.e. they
      // haven't clicked to stop reconnecting while we were waiting for the
      // ping response).
      if (model.reconnecting) {
        this.core.login({network: network, reconnect: true}).then(() => {
          this.stopReconnect();
        }).catch((e) => {
          // Reconnect failed, give up.
          this.stopReconnect();
          this.showNotification(
              this.i18n_t('loggedOut', { network: network }));

          if (!model.onlineNetworks.length) {
            this.view = ui_constants.View.SPLASH;
          }
        });
      }
    });
  }

  public stopReconnect = () => {
    model.reconnecting = false;
  }

  private cloudfrontDomains_ = [
    "d1wtwocg4wx1ih.cloudfront.net"
  ]

  public postToCloudfrontSite = (payload :any, cloudfrontPath :string,
                                 maxAttempts ?:number)
      : Promise<void> => {
    console.log('postToCloudfrontSite: ', payload, cloudfrontPath);
    if (!maxAttempts || maxAttempts > this.cloudfrontDomains_.length) {
      // default to trying every possible URL
      maxAttempts = this.cloudfrontDomains_.length;
    }
    var attempts = 0;
    var doAttempts = (error ?:Error) : Promise<void> => {
      if (attempts < maxAttempts) {
        // we want to keep trying this until we either run out of urls to
        // send to or one of the requests succeeds.  We set this up by
        // creating a lambda to call the post with failures set up to recurse
        return this.browserApi.frontedPost(payload, this.AWS_FRONT_DOMAIN,
          this.cloudfrontDomains_[attempts++], cloudfrontPath
        ).catch(doAttempts);
      }
      throw error;
    }
    return doAttempts();
  }

  public sendFeedback =
      (feedback :uproxy_core_api.UserFeedback) : Promise<void> => {
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
      var payload = {
        email: feedback.email,
        feedback: feedback.feedback,
        logs: logs
      };
      return this.postToCloudfrontSite(payload, 'submit-feedback');
    });
  }

  public setMode = (mode :ui_constants.Mode) => {
    model.globalSettings.mode = mode;
    this.core.updateGlobalSettings(model.globalSettings);
  }

  public updateLanguage = (newLanguage :string) => {
    model.globalSettings.language = newLanguage;
    this.core.updateGlobalSettings(model.globalSettings);
    this.i18n_setLng(newLanguage);
  }

  private updateInitialState = (state :uproxy_core_api.InitialState) => {
    model.networkNames = state.networkNames;

    if (state.globalSettings.language !== model.globalSettings.language) {
      this.i18n_setLng(state.globalSettings.language);
    }

    // TODO: Do not allow reassignment of globalSettings. Instead
    // write a 'syncGlobalSettings' function that iterates through
    // the values in state[globalSettings] and assigns the
    // individual values to model.globalSettings. This is required
    // because Polymer elements bound to globalSettings' values can
    // only react to updates to globalSettings and not reassignments.
    model.globalSettings = state.globalSettings;
  }
}  // class UserInterface
