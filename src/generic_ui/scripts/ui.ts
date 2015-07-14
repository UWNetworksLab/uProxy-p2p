/// <reference path='../../../../third_party/typings/i18next/i18next.d.ts' />

/**
 * ui.ts
 *
 * Common User Interface state holder and changer.
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
import Constants = require('./constants');
import translator_module = require('./translator');
import _ = require('lodash');

// Filenames for icons.
// Two important things about using these strings:
// 1) When updating the icon strings below, default values in the Chrome
// manifests and Firefox main.js should also be changed to match.
// 2) These are only the suffixes of the icon names. Because we have
// different sizes of icons, the actual filenames have the dimension
// as a prefix. E.g. "19_online.gif" for the 19x19 pixel version.

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
    splashState : 0,
    mode : ui_constants.Mode.GET,
    allowNonUnicast: false,
    statsReportingEnabled: false,
    consoleFilter: 2, // loggingTypes.Level.warn
    language: 'en',
    force_message_version: 0
  };

  public reconnecting = false;

  // userId is included as an optional parameter because we will eventually
  // want to use it to get an accurate network.  For now, it is ignored and
  // serves to remind us of where we still need to add the info
  public getNetwork = (networkName :string, userId?:string) :Network => {
    return _.find(this.onlineNetworks, { name: networkName });
  }

  public removeNetwork = (networkName :string, userId :string) => {
    var network = this.getNetwork(networkName, userId);

    for (var otherUserId in network.roster) {
      var user = this.getUser(network, otherUserId);
      var userCategories = user.getCategories();
      categorizeUser(user, this.contacts.getAccessContacts,
                     userCategories.getTab, null);
      categorizeUser(user, this.contacts.shareAccessContacts,
                     userCategories.shareTab, null);
    }

    _.remove(this.onlineNetworks, { name: networkName });
  }

  public getUser = (network :Network, userId :string) :User => {
    if (network.roster[userId]) {
      return network.roster[userId];
    }

    return null;
  }

  public updateGlobalSettings = (settings :Object) => {
    _.merge(this.globalSettings, settings, (a :any, b :any) => {
      if (_.isArray(a) && _.isArray(b)) {
        return b;
      }

      return undefined;
    });
  }
}

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
  public view :ui_constants.View;

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

  public copyPasteState :uproxy_core_api.ConnectionState = {
    localGettingFromRemote: social.GettingState.NONE,
    localSharingWithRemote: social.SharingState.NONE,
    bytesSent: 0,
    bytesReceived: 0
  };

  public copyPasteError :ui_constants.CopyPasteError = ui_constants.CopyPasteError.NONE;
  public copyPasteGettingMessages :social.PeerMessage[] = [];
  public copyPasteSharingMessages :social.PeerMessage[] = [];

  public browser :string = '';

  // Changing this causes root.ts to fire a core-signal
  // with the new value.
  public signalToFire :string = '';

  public toastMessage :string = null;
  public unableToGet :boolean = false;
  public unableToShare :boolean = false;

  // ID of the most recent failed proxying attempt.
  public proxyingId: string;

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

  public i18n_t :Function = translator_module.i18n_t;
  public i18n_setLng :Function = translator_module.i18n_setLng;

  public model = new Model();

  public availableVersion :string = null;

  /**
   * UI must be constructed with hooks to Notifications and Core.
   * Upon construction, the UI installs update handlers on core.
   */
  constructor(
      public core   :CoreConnector,
      public browserApi :BrowserAPI) {
    // TODO: Determine the best way to describe view transitions.
    this.view = ui_constants.View.SPLASH;  // Begin at the splash intro.
    this.i18n_setLng(this.model.globalSettings.language);

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

    core.onUpdate(uproxy_core_api.Update.COPYPASTE_MESSAGE,
        (message :uproxy_core_api.CopyPasteMessages) => {
      switch (message.type) {
        case social.PeerMessageType.SIGNAL_FROM_CLIENT_PEER:
          this.copyPasteGettingMessages = message.data;
          break;
        case social.PeerMessageType.SIGNAL_FROM_SERVER_PEER:
          this.copyPasteSharingMessages = message.data;
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
      this.copyPasteState.localSharingWithRemote = social.SharingState.NONE;
      if (!this.isGivingAccess()) {
        this.stopGivingInUi();
      }
    });

    // status of the current copy+paste connection
    core.onUpdate(uproxy_core_api.Update.STATE, (state :uproxy_core_api.ConnectionState) => {
      this.copyPasteState = state;
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

    core.onUpdate(uproxy_core_api.Update.FAILED_TO_GIVE,
        (info:uproxy_core_api.FailedToGetOrGive) => {
      console.error('proxying attempt ' + info.proxyingId + ' failed (giving)');

      this.toastMessage = this.i18n_t('unableToShareWith', {
        name: info.name
      });
      this.unableToShare = true;
      this.proxyingId = info.proxyingId;
    });

    core.onUpdate(uproxy_core_api.Update.FAILED_TO_GET,
        (info:uproxy_core_api.FailedToGetOrGive) => {
      console.error('proxying attempt ' + info.proxyingId + ' failed (getting)');

      this.toastMessage = this.i18n_t('unableToGetFrom', {
        name: info.name
      });
      this.instanceTryingToGetAccessFrom = null;
      this.unableToGet = true;
      this.proxyingId = info.proxyingId;
      this.bringUproxyToFront();
    });

    core.onUpdate(
        uproxy_core_api.Update.POST_TO_CLOUDFRONT,
        (data :uproxy_core_api.CloudfrontPostData) => {
      this.postToCloudfrontSite(data.payload, data.cloudfrontPath);
    });

    core.onUpdate(uproxy_core_api.Update.CORE_UPDATE_AVAILABLE, this.coreUpdateAvailable_);

    browserApi.on('urlData', this.handleUrlData);
    browserApi.on('notificationClicked', this.handleNotificationClick);
    browserApi.on('proxyDisconnected', this.proxyDisconnected);

    core.getFullState()
        .then(this.updateInitialState)
        .then(this.browserApi.handlePopupLaunch);
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
    this.bringUproxyToFront();

    try {
      var data = JSON.parse(tag);

      if (data.network && data.user) {
        var network = this.model.getNetwork(data.network);
        if (network) {
          var contact = this.model.getUser(network, data.user);
        }
      }

      if (data.mode === 'get') {
        this.model.globalSettings.mode = ui_constants.Mode.GET;
        this.core.updateGlobalSettings(this.model.globalSettings);
        if (contact) {
          contact.getExpanded = true;
        }
      } else if (data.mode === 'share' && !this.isSharingDisabled) {
        this.model.globalSettings.mode = ui_constants.Mode.SHARE;
        this.core.updateGlobalSettings(this.model.globalSettings);
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

    if (this.model.onlineNetworks.length > 0) {
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

    if (social.SharingState.NONE !== this.copyPasteState.localSharingWithRemote) {
      console.info('should not be processing a URL while in the middle of sharing');
      this.copyPasteError = ui_constants.CopyPasteError.UNEXPECTED;
      return;
    }

    // at this point, we assume everything is good, so let's check state
    switch (match[1]) {
      case 'request':
        expectedType = social.PeerMessageType.SIGNAL_FROM_CLIENT_PEER;
        this.copyPasteSharingMessages = [];
        this.core.startCopyPasteShare();
        break;
      case 'offer':
        expectedType = social.PeerMessageType.SIGNAL_FROM_SERVER_PEER;
        if (social.GettingState.TRYING_TO_GET_ACCESS
            !== this.copyPasteState.localGettingFromRemote) {
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
      this.bringUproxyToFront();
      this.core.disconnectedWhileProxying = true;
      this.updateIcon_();
      return;
    }

    this.core.disconnectedWhileProxying = false;
    this.proxySet_ = false;
    this.updateIcon_();
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

    if (this.core.disconnectedWhileProxying) {
      this.browserApi.setIcon(Constants.ERROR_ICON);
    } else if (isGetting && isGiving) {
      this.browserApi.setIcon(Constants.GETTING_SHARING_ICON);
    } else if (isGetting) {
      this.browserApi.setIcon(Constants.GETTING_ICON);
    } else if (isGiving) {
      this.browserApi.setIcon(Constants.SHARING_ICON);
    } else if (this.model.onlineNetworks.length > 0) {
      this.browserApi.setIcon(Constants.DEFAULT_ICON);
    } else {
      this.browserApi.setIcon(Constants.LOGGED_OUT_ICON);
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
           this.copyPasteState.localSharingWithRemote === social.SharingState.SHARING_ACCESS;
  }

  /**
   * Synchronize a new network to be visible on this UI.
   */
  private syncNetwork_ = (networkMsg :social.NetworkMessage) => {
    var existingNetwork = this.model.getNetwork(networkMsg.name, networkMsg.userId);

    if (networkMsg.online) {
      if (!existingNetwork) {
        existingNetwork = {
          name: networkMsg.name,
          userId: networkMsg.userId,
          roster: {},
          logoutExpected: false,
          userName: networkMsg.userName,
          imageData: networkMsg.imageData
        };
        this.model.onlineNetworks.push(existingNetwork);
      }
    } else {
      if (existingNetwork) {
        this.model.removeNetwork(networkMsg.name, networkMsg.userId);

        if (!existingNetwork.logoutExpected &&
            (networkMsg.name === 'Google' || networkMsg.name === 'Facebook') &&
            !this.core.disconnectedWhileProxying && !this.instanceGettingAccessFrom_) {
          console.warn('Unexpected logout, reconnecting to ' + networkMsg.name);
          this.reconnect(networkMsg.name);
        } else {
          if (this.instanceGettingAccessFrom_) {
            this.stopGettingInUiAndConfig(true);
          }
          this.showNotification(this.i18n_t('loggedOut', {network: networkMsg.name}));

          if (!this.model.onlineNetworks.length) {
            this.view = ui_constants.View.SPLASH;
          }
        }
      }
    }

    this.updateIcon_();
  }

  private syncUserSelf_ = (payload :social.UserData) => {
    var network = this.model.getNetwork(payload.network);
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
    var network = this.model.getNetwork(payload.network);
    if (!network) {
       return;
    }

    // Construct a UI-specific user object.
    var profile = payload.user;
    // Update / create if necessary a user, both in the network-specific
    // roster and the global roster.
    var user :User;
    user = this.model.getUser(network, profile.userId);
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

    for (var i = 0; i < payload.offeringInstances.length; i++) {
      if (payload.offeringInstances[i].localGettingFromRemote ===
          social.GettingState.GETTING_ACCESS) {
        this.instanceGettingAccessFrom_ = payload.offeringInstances[i].instanceId;
        user.isSharingWithMe = true;
        this.updateGettingStatusBar_();
        break;
      }
    }

    for (var i = 0; i < payload.instancesSharingWithLocal.length; i++) {
      this.instancesGivingAccessTo[payload.instancesSharingWithLocal[i]] = true;
      user.isGettingFromMe = true;
    }

    var newUserCategories = user.getCategories();
    // Update the user's category in both get and share tabs.
    categorizeUser(user, this.model.contacts.getAccessContacts,
        oldUserCategories.getTab, newUserCategories.getTab);
    categorizeUser(user, this.model.contacts.shareAccessContacts,
        oldUserCategories.shareTab, newUserCategories.shareTab);

    console.log('Synchronized user.', user);
  };

  public openTab = (url :string) => {
    this.browserApi.openTab(url);
  }

  public bringUproxyToFront = () => {
    this.browserApi.bringUproxyToFront();
  }

  public login = (network :string) : Promise<void> => {
    return this.core.login({ network : network, reconnect: false }).catch((e :Error) => {
      this.showNotification(this.i18n_t('errorSigningIn', {network: network}));
      throw e;
    });
  }

  public logout = (networkInfo :social.SocialNetworkInfo) : Promise<void> => {
    var network = this.model.getNetwork(networkInfo.name);
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
    this.model.reconnecting = true;
    var pingUrl = network == 'Facebook'
        ? 'https://graph.facebook.com' : 'https://www.googleapis.com';
    this.core.pingUntilOnline(pingUrl).then(() => {
      // Ensure that the user is still attempting to reconnect (i.e. they
      // haven't clicked to stop reconnecting while we were waiting for the
      // ping response).
      if (this.model.reconnecting) {
        this.core.login({network: network, reconnect: true}).then(() => {
          this.stopReconnect();
        }).catch((e) => {
          // Reconnect failed, give up.
          this.stopReconnect();
          this.showNotification(
              this.i18n_t('loggedOut', { network: network }));

          if (!this.model.onlineNetworks.length) {
            this.view = ui_constants.View.SPLASH;
          }
        });
      }
    });
  }

  public stopReconnect = () => {
    this.model.reconnecting = false;
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
      var payload :uproxy_core_api.UserFeedback = {
        email: feedback.email,
        feedback: feedback.feedback,
        logs: logs,
        feedbackType: feedback.feedbackType
      };

      if (payload.feedbackType ===
          uproxy_core_api.UserFeedbackType.PROXYING_FAILURE) {
        payload.proxyingId = this.proxyingId;
      }

      return this.postToCloudfrontSite(payload, 'submit-feedback');
    });
  }

  public setMode = (mode :ui_constants.Mode) => {
    this.model.globalSettings.mode = mode;
    this.core.updateGlobalSettings(this.model.globalSettings);
  }

  public updateLanguage = (newLanguage :string) => {
    this.model.globalSettings.language = newLanguage;
    this.core.updateGlobalSettings(this.model.globalSettings);
    this.i18n_setLng(newLanguage);
  }

  public updateInitialState = (state :uproxy_core_api.InitialState) => {
    console.log('Received uproxy_core_api.Update.INITIAL_STATE:', state);
    this.model.networkNames = state.networkNames;
    this.availableVersion = state.availableVersion;
    if (state.globalSettings.language !== this.model.globalSettings.language) {
      this.i18n_setLng(state.globalSettings.language);
    }
    this.model.updateGlobalSettings(state.globalSettings);

    // Maybe refactor this to be copyPasteState.
    this.copyPasteState = state.copyPasteState.connectionState;
    this.copyPasteGettingMessages = state.copyPasteState.gettingMessages;
    this.copyPasteSharingMessages = state.copyPasteState.sharingMessages;
    this.copyPastePendingEndpoint = state.copyPasteState.endpoint;
    if (this.copyPasteState.localGettingFromRemote !== social.GettingState.NONE ||
        this.copyPasteState.localSharingWithRemote !== social.SharingState.NONE) {
      // This means we had active copy-paste flow.
      this.view = ui_constants.View.COPYPASTE;
    }

    while (this.model.onlineNetworks.length > 0) {
      var toRemove = this.model.onlineNetworks[0];

      this.model.removeNetwork(toRemove.name, toRemove.userId);
    }

    for (var network in state.onlineNetworks) {
      this.addOnlineNetwork_(state.onlineNetworks[network]);
    }

    if (state.onlineNetworks.length > 0) {
      // Check that we dont' have copy paste connection
      if (this.view === ui_constants.View.COPYPASTE) {
        console.error(
            'User cannot be online while having a copy-paste connection');
      }
      // Set view to roster, user is online.
      this.view = ui_constants.View.ROSTER;
      this.updateSharingStatusBar_();
    }
  }

  private addOnlineNetwork_ = (networkState :social.NetworkState) => {
    this.model.onlineNetworks.push({
      name:   networkState.name,
      userId: networkState.profile.userId,
      userName: networkState.profile.name,
      imageData: networkState.profile.imageData,
      logoutExpected: false,
      roster: {}
    });

    for (var userId in networkState.roster) {
      this.syncUser(networkState.roster[userId]);
    }
  }

  private coreUpdateAvailable_ = (data :{version :string}) => {
    this.availableVersion = data.version;
  }
} // class UserInterface

// non-exported method to handle categorizing users
function categorizeUser(user :User, contacts :ContactCategory, oldCategory :string, newCategory :string) {
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
