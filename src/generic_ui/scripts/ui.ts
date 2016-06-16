/// <reference path='../../../../third_party/typings/generic/jdenticon.d.ts' />
/// <reference path='../../../../third_party/typings/generic/jsurl.d.ts' />
/// <reference path='../../../../third_party/typings/generic/md5.d.ts' />
/// <reference path='../../../../third_party/typings/generic/uparams.d.ts' />

/**
 * ui.ts
 *
 * Common User Interface state holder and changer.
 */

import ui_constants = require('../../interfaces/ui');
import background_ui = require('./background_ui');
import CopyPasteState = require('./copypaste-state');
import CoreConnector = require('./core_connector');
import uproxy_core_api = require('../../interfaces/uproxy_core_api');
import browser_api = require('../../interfaces/browser_api');
import BrowserAPI = browser_api.BrowserAPI;
import ProxyDisconnectInfo = browser_api.ProxyDisconnectInfo;
import net = require('../../lib/net/net.types');
import user_module = require('./user');
import User = user_module.User;
import social = require('../../interfaces/social');
import Constants = require('./constants');
import translator_module = require('./translator');
import network_options = require('../../generic/network-options');
import model = require('./model');
import jsurl = require('jsurl');
import uparams = require('uparams');
import md5 = require('md5');
import jdenticon = require('jdenticon');

var NETWORK_OPTIONS = network_options.NETWORK_OPTIONS;

// Filenames for icons.
// Two important things about using these strings:
// 1) When updating the icon strings below, default values in the Chrome
// manifests and Firefox main.js should also be changed to match.
// 2) These are only the suffixes of the icon names. Because we have
// different sizes of icons, the actual filenames have the dimension
// as a prefix. E.g. "19_online.gif" for the 19x19 pixel version.

export interface UserCategories {
  getTab :string;
  shareTab :string;
}

export interface NotificationData {
  mode :string;
  network :string;
  user :string;
  unique ?:string;
}

interface PromiseCallbacks {
  fulfill :Function;
  reject :Function;
}

export function getImageData(userId :string, oldImageData :string,
                             newImageData :string) : string {
  if (!oldImageData && !newImageData) {
    // Extra single-quotes are needed for CSS/Polymer parsing.  This is safe
    // as long as jdenticon only uses '"' in the generated code...
    // The size is arbitrarily set to 100 pixels.  SVG is scalable and our CSS
    // scales the image to fit the space, so this parameter has no effect.
    // We must also replace # with %23 for Firefox support.
    return '\'data:image/svg+xml;utf8,' +
        jdenticon.toSvg(md5(userId), 100).replace(/#/g, '%23') + '\'';
  } else if (!newImageData) {
    // This case is hit when we've already generated a jdenticon for a user
    // who doesn't have any image in uProxy core.
    return oldImageData;
  } else {
    return newImageData;
  }
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
  public model = new model.Model();

  /* Instance management */
  // Instance you are getting access from. Null if you are not getting access.
  public instanceTryingToGetAccessFrom :string = null;
  private instanceGettingAccessFrom_ :string = null;
  // The instances you are giving access to.
  // Remote instances to add to this set are received in messages from Core.
  public instancesGivingAccessTo :{[instanceId :string] :boolean} = {};
  private mapInstanceIdToUser_ :{[instanceId :string] :User} = {};

  /* Getting and sharing */
  public gettingStatus :string = null;
  public sharingStatus :string = null;
  public unableToGet :boolean = false;
  public unableToShare :boolean = false;
  public isSharingDisabled :boolean = false;
  public proxyingId: string; // ID of the most recent failed proxying attempt.
  private userCancelledGetAttempt_ :boolean = false;

  /* Copypaste */
  /*
   * This is used to store the information for setting up a copy+paste
   * connection between establishing the connection and the user confirming
   * the start of proxying
   */
  public copyPasteState :CopyPasteState = new CopyPasteState();

  /* Translation */
  public i18n_t :Function = translator_module.i18n_t;
  public i18n_setLng :Function = translator_module.i18n_setLng;

  /* About this uProxy installation */
  public portControlSupport = uproxy_core_api.PortControlSupport.PENDING;
  public browser :string = '';
  public availableVersion :string = null;

  public toastMessage :string = null;

  // Please note that this value is updated periodically so may not reflect current reality.
  private isConnectedToCellular_ :boolean = false;

  public cloudInstallStatus :string = '';
  public cloudInstallProgress = 0;

  /**
   * UI must be constructed with hooks to Notifications and Core.
   * Upon construction, the UI installs update handlers on core.
   */
  constructor(
      public core   :CoreConnector,
      public browserApi :BrowserAPI,
      public backgroundUi: background_ui.BackgroundUi) {
    this.updateView_();

    var firefoxMatches = navigator.userAgent.match(/Firefox\/(\d+)/);
    if (firefoxMatches) {
      if (parseInt(firefoxMatches[1], 10) === 37) {
        this.isSharingDisabled = true;
      }
    }

    core.on('core_connect', () => {
      this.updateView_();

      core.getFullState()
          .then(this.updateInitialState);
    });

    core.on('core_disconnect', () => {
      // When disconnected from the app, we should show the browser specific page
      // that shows the "app missing" message.
      this.view = ui_constants.View.BROWSER_ERROR;

      if (this.isGettingAccess()) {
        this.stoppedGetting({instanceId: null, error: true});
      }
    });

    // Add or update the online status of a network.
    core.onUpdate(uproxy_core_api.Update.NETWORK, this.syncNetwork_);

    // Attach handlers for USER updates.
    core.onUpdate(uproxy_core_api.Update.USER_SELF, this.syncUserSelf_);

    core.onUpdate(uproxy_core_api.Update.USER_FRIEND, this.syncUser);

    core.onUpdate(uproxy_core_api.Update.REMOVE_FRIEND, this.removeFriend);

    core.onUpdate(uproxy_core_api.Update.ONETIME_MESSAGE, (message:string) => {
      this.copyPasteState.message = message;
    });

    // indicates the current getting connection has ended
    core.onUpdate(uproxy_core_api.Update.STOP_GETTING, (error :boolean) => {
      this.copyPasteState.activeEndpoint = null;
      this.copyPasteState.active = false;
      this.stoppedGetting({instanceId: null, error: error});
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
      this.copyPasteState.updateFromConnectionState(state);
    });

    core.onUpdate(uproxy_core_api.Update.STOP_GETTING_FROM_FRIEND,
        (data :social.StopProxyInfo) => { // TODO better type
        this.stoppedGetting(data);
    });

    var checkConnectivityIntervalId: NodeJS.Timer;
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
      this.showNotification(this.i18n_t('STARTED_PROXYING',
          { name: user.name }), { mode: 'share', network: user.network.name, user: user.userId });
      checkConnectivityIntervalId = setInterval(
          this.notifyUserIfConnectedToCellular_,
          5 * 60 * 1000);
    });

    core.onUpdate(uproxy_core_api.Update.STOP_GIVING_TO_FRIEND,
        (instanceId :string) => {
      var isGettingFromMe = false;
      var user = this.mapInstanceIdToUser_[instanceId];

      // only show a notification if we knew we were prokying
      if (typeof this.instancesGivingAccessTo[instanceId] !== 'undefined') {
        this.showNotification(this.i18n_t('STOPPED_PROXYING',
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
      if (checkConnectivityIntervalId && Object.keys(this.instancesGivingAccessTo).length === 0) {
        clearInterval(checkConnectivityIntervalId);
        checkConnectivityIntervalId = undefined;
        this.isConnectedToCellular_ = false;
      }
    });

    core.onUpdate(uproxy_core_api.Update.FAILED_TO_GIVE,
        (info:uproxy_core_api.FailedToGetOrGive) => {
      console.error('proxying attempt ' + info.proxyingId + ' failed (giving)');

      this.toastMessage = this.i18n_t('UNABLE_TO_SHARE_WITH', {
        name: info.name
      });
      this.unableToShare = true;
      this.proxyingId = info.proxyingId;
    });

    core.onUpdate(uproxy_core_api.Update.FAILED_TO_GET,
        (info:uproxy_core_api.FailedToGetOrGive) => {
      if (this.userCancelledGetAttempt_) {
        console.error('proxying attempt ' + info.proxyingId +
            ' cancelled (getting)');
        this.userCancelledGetAttempt_ = false; // Reset.
      } else {
        console.error('proxying attempt ' + info.proxyingId +
            ' failed (getting)');
        if (!this.core.disconnectedWhileProxying) {
          // This is an immediate failure, i.e. failure of a connection attempt
          // that never connected.  It is not a retry.
          // Show the error toast indicating that a get attempt failed.
          var user = this.mapInstanceIdToUser_[info.name];
          if (user.status === social.UserStatus.CLOUD_INSTANCE_CREATED_BY_LOCAL) {
            this.restartServer_('digitalocean');
          } else {
            this.toastMessage = this.i18n_t('UNABLE_TO_GET_FROM', {
              name: info.name
            });
            this.unableToGet = true;
          }
        }
      }
      this.instanceTryingToGetAccessFrom = null;
      this.proxyingId = info.proxyingId;
      this.bringUproxyToFront();
    });

    core.onUpdate(uproxy_core_api.Update.CORE_UPDATE_AVAILABLE, this.coreUpdateAvailable_);

    core.onUpdate(uproxy_core_api.Update.PORT_CONTROL_STATUS,
                  this.setPortControlSupport_);

    core.onUpdate(uproxy_core_api.Update.CLOUD_INSTALL_STATUS, (status: string) => {
      this.cloudInstallStatus = this.i18n_t(status);
    });

    core.onUpdate(uproxy_core_api.Update.CLOUD_INSTALL_PROGRESS, (progress: number) => {
      this.cloudInstallProgress = progress;
    });

    browserApi.on('copyPasteUrlData', this.handleCopyPasteUrlData);
    browserApi.on('inviteUrlData', this.handleInvite);
    browserApi.on('notificationClicked', this.handleNotificationClick);
    browserApi.on('proxyDisconnected', this.proxyDisconnected);
    browserApi.on('promoIdDetected', this.setActivePromoId);
    browserApi.on('translationsRequest', this.handleTranslationsRequest);
    browserApi.on('globalSettingsRequest', this.handleGlobalSettingsRequest);
    backgroundUi.registerAsFakeBackground(this.panelMessageHandler);

    core.getFullState()
        .then(this.updateInitialState)
        .then(this.browserApi.handlePopupLaunch);
  }

  public panelMessageHandler = (name: string, data: Object) => {
    /*
     * This will handle a subset of the signals for the actual background UI,
     * we will try to handle most of the signals in the actual background
     * though
     */
    switch(name) {
      case 'logout-all':
        this.logoutAll((<any>data).getConfirmation);
        break;
    }
  }

  public restartServer_ = (providerName :string) => {
    this.getConfirmation(
      this.i18n_t('RESTART_SERVER_TITLE'),
      this.i18n_t('RESTART_SERVER_TEXT'),
      this.i18n_t('CANCEL'),
      this.i18n_t('RESTART_SERVER')
    ).then(() => {
      this.toastMessage = this.i18n_t('RESTARTING_SERVER');
      return this.core.cloudUpdate({
        operation: uproxy_core_api.CloudOperationType.CLOUD_REBOOT,
        providerName: providerName
      }).then(() => {
        this.toastMessage = this.i18n_t('RESTART_SUCCESS');
      }).catch((e: Error) => {
        this.showDialog(this.i18n_t('RESTART_FAILURE_TITLE'), this.i18n_t('RESTART_FAILURE_TEXT'));
      });
    }).then(() => {
      this.bringUproxyToFront();
    });
  }

  private notifyUserIfConnectedToCellular_ = () => {
    this.browserApi.isConnectedToCellular().then((isConnectedToCellular) => {
      if (isConnectedToCellular && !this.isConnectedToCellular_) {
        this.showNotification('Your friend is proxying through your cellular network which could'
          + ' incur charges.');
      }
      this.isConnectedToCellular_ = isConnectedToCellular;
    }, function(reason) {
      console.log('Could not check if connected to cellular or not. reason: ' + reason);
    });
  }

  public fireSignal = (signalName :string, data ?:Object) => {
    this.backgroundUi.fireSignal(signalName, data);
  }

  private confirmationCallbacks_ :{[index :number] :PromiseCallbacks} = {};
  // Don't use index 0 as it may be treated as false in confirmation code.
  private confirmationCallbackIndex_ = 1;

  public getConfirmation(heading :string,
                         text :string,
                         dismissButtonText ?:string,
                         fulfillButtonText ?:string): Promise<void> {
    return new Promise<void>((F, R) => {
      var callbackIndex = ++this.confirmationCallbackIndex_;
      this.confirmationCallbacks_[callbackIndex] = {fulfill: F, reject: R};
      this.fireSignal('open-dialog', {
        heading: heading,
        message: text,
        buttons: [{
          text: dismissButtonText ? dismissButtonText : this.i18n_t('NO'),
          callbackIndex: callbackIndex,
          dismissive: true
        }, {
          text: fulfillButtonText ? fulfillButtonText : this.i18n_t('YES'),
          callbackIndex: callbackIndex
        }]
      });
    });
  }

  public getUserInput(heading :string, 
                      message :string, 
                      placeholderText :string, 
                      defaultValue :string, 
                      buttonText :string) : Promise<string> {
    return new Promise<string>((F, R) => {
      var callbackIndex = ++this.confirmationCallbackIndex_;
      this.confirmationCallbacks_[callbackIndex] = {fulfill: F, reject: R};
      this.fireSignal('open-dialog', {
        heading: heading,
        message: message,
        buttons: [{
          text: buttonText,
          callbackIndex: callbackIndex
        }],
        userInputData: {
          placeholderText: placeholderText,
          initInputValue: defaultValue
        }
      });
    });
  }

  public showDialog(heading :string, message :string, buttonText ?:string,
                    signal ?:string, displayData ?:string) {
    var button :ui_constants.DialogButtonDescription = {
      text: buttonText || this.i18n_t('OK')
    };
    if (signal) {
      button['signal'] = signal;
    }
    this.fireSignal('open-dialog', {
      heading: heading,
      message: message,
      buttons: [button],
      displayData: displayData || null
    });
  }

  public invokeConfirmationCallback = (index :number, fulfill :boolean, data ?:any) => {
    if (index > this.confirmationCallbackIndex_) {
      console.error('Confirmation callback not found: ' + index);
      return;
    }
    if (fulfill) {
      this.confirmationCallbacks_[index].fulfill(data);
    } else {
      this.confirmationCallbacks_[index].reject(data);
    }
    delete this.confirmationCallbacks_[index];
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
      this.gettingStatus = this.i18n_t('GETTING_ACCESS_FROM', {
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
      this.sharingStatus = this.i18n_t('SHARING_ACCESS_WITH_ONE', {
        name: this.mapInstanceIdToUser_[instanceIds[0]].name
      });
    } else if (instanceIds.length === 2) {
      this.sharingStatus = this.i18n_t('SHARING_ACCESS_WITH_TWO', {
        name1: this.mapInstanceIdToUser_[instanceIds[0]].name,
        name2: this.mapInstanceIdToUser_[instanceIds[1]].name
      });
    } else {
      this.sharingStatus = this.i18n_t('SHARING_ACCESS_WITH_MANY', {
        name: this.mapInstanceIdToUser_[instanceIds[0]].name,
        numOthers: (instanceIds.length - 1)
      });
    }
  }

  public parseUrlData = (url:string) : { type:social.PeerMessageType; message:string } => {
    var match = url.match(/https:\/\/www.uproxy.org\/(request|offer)[/#]+(.*)/)
    if (!match) {
      throw new Error('invalid URL format');
    }
    return {
      type: match[1] === 'request' ?
          social.PeerMessageType.SIGNAL_FROM_CLIENT_PEER :
          social.PeerMessageType.SIGNAL_FROM_SERVER_PEER,
      message: decodeURIComponent(match[2])
    };
  }

  private addUser_ = (tokenObj :social.InviteTokenData, showConfirmation :boolean) : Promise<void> => {
    try {
      var userName = tokenObj.userName;
      var networkName = tokenObj.networkName;
    } catch(e) {
      return Promise.reject('Error parsing invite token');
    }

    var getConfirmation = Promise.resolve<void>();
    if (showConfirmation) {
      if (networkName === 'Cloud') {
        userName = this.i18n_t('CLOUD_VIRTUAL_MACHINE');
      }
      var confirmationMessage =
          this.i18n_t('ACCEPT_INVITE_CONFIRMATION', { name: userName });
      getConfirmation = this.getConfirmation('', confirmationMessage);
    }

    return getConfirmation.then(() => {
      var socialNetworkInfo :social.SocialNetworkInfo = {
        name: networkName,
        userId: '' /* The current user's ID will be determined by the core. */
      };
      return this.core.acceptInvitation(
          {network: socialNetworkInfo, tokenObj: tokenObj});
    }).catch((e) => {
      // The user did not confirm adding their friend, not an error.
      return;
    })
  }

  private parseInviteUrl_ = (invite :string) : social.InviteTokenData => {
    try {
      var params = uparams(invite);
      if (params && params['networkName']) {
        // New style invite using URL params.
        var permission :any;
        if (params['permission']) {
          permission = jsurl.parse(params['permission']);
        }
        return {
          v: parseInt(params['v'], 10),
          networkData: jsurl.parse(params['networkData']),
          networkName: params['networkName'],
          userName: params['userName'],
          permission: permission,
          userId: params['userId'],  // undefined if no permission
          instanceId: params['instanceId'],  // undefined if no permission
        }
      } else {
        // Old v1 invites are base64 encoded JSON
        var lastNonCodeCharacter = Math.max(invite.lastIndexOf('/'), invite.lastIndexOf('#'));
        var token = invite.substr(lastNonCodeCharacter + 1);

        // Removes any non base64 characters that may appear, e.g. "%E2%80%8E"
        token = token.match('[A-Za-z0-9+/=_]+')[0];
        var parsedObj = JSON.parse(atob(token));
        var networkData = parsedObj.networkData;
        if (typeof networkData === 'object' && networkData.networkData) {
          // Firebase invites have a nested networkData string within a
          // networkData object.  TODO: move Firebase to use v2 invites.
          networkData = networkData.networkData;
        }
        return {
          v: 1,
          networkData: networkData,
          networkName: parsedObj.networkName,
          userName: parsedObj.userName,
          permission: parsedObj.permission,
          userId: parsedObj.userId,
          instanceId: parsedObj.instanceId,
        };
      }
    } catch(e) {
      return null;
    }
  }

  public handleInvite = (invite :string) : Promise<void> => {
    var showTokenError = () => {
      this.showDialog('', this.i18n_t('INVITE_ERROR'));
    };

    var tokenObj = this.parseInviteUrl_(invite);
    if (!tokenObj) {
      showTokenError();
      return;
    }
    var userName = tokenObj.userName;
    var networkName = tokenObj.networkName;

    if (networkName == 'Cloud') {
      // Log into cloud if needed.
      var loginPromise = Promise.resolve<void>();
      if (!this.model.getNetwork('Cloud')) {
        loginPromise = this.login('Cloud');
      }
      return loginPromise.then(() => {
        // Cloud contacts only appear on the GET tab.
        this.setMode(ui_constants.Mode.GET);
        // Don't show an additional confirmation for Cloud.
        return this.addUser_(tokenObj, false).catch(showTokenError);
      });
    }

    if (this.model.getNetwork(networkName)) {
      // User is already logged into the right network (other than Cloud).
      return this.addUser_(tokenObj, true).catch(showTokenError);
    }

    // loginPromise should resolve when the use is logged into networkName.
    var loginPromise :Promise<void>;
    if (networkName == 'Quiver') {
      // Show user confirmation for Quiver login, where they can enter their
      // Quiver user name.
      var message = this.i18n_t('UPROXY_NETWORK_INVITE_LOGIN_MESSAGE',
          {name: userName });
      loginPromise = this.loginToQuiver(message);
    } else {
      // All networks other than Quiver and Cloud.
      var confirmationTitle = this.i18n_t('LOGIN_REQUIRED_TITLE');
      var confirmationMessage =
          this.i18n_t('LOGIN_REQUIRED_MESSAGE',
          { network: this.getNetworkDisplayName(networkName), name: userName });
      loginPromise = this.getConfirmation(confirmationTitle, confirmationMessage)
      .then(() => {
        return this.login(networkName).then(() => {
          // For networks other than Quiver and Cloud, login will open an
          // OAuth tab.  We need to return to the roster and re-open the uProxy
          // popup.
          this.view = ui_constants.View.ROSTER;
          this.bringUproxyToFront();
        });
      });
    }

    return loginPromise.then(() => {
      // User already saw a confirmation when they logged into the network,
      // don't show an additional confirmation.
      return this.addUser_(tokenObj, false).catch(showTokenError);
    });
  }

  public loginToQuiver = (message ?:string) : Promise<void> => {
    if (message) {
      message += '<p>' + this.i18n_t('QUIVER_LOGIN_TEXT') + '</p>';
    } else {
      message = this.i18n_t('QUIVER_LOGIN_TEXT');
    }
    return this.getUserInput(
        this.i18n_t('UPROXY_NETWORK_LOGIN_TITLE'),
        message || '',
        this.i18n_t('UPROXY_NETWORK_CHOOSE_A_USER_NAME'),
        this.model.globalSettings.quiverUserName,
        this.i18n_t('UPROXY_NETWORK_SIGN_IN'))
    .then((quiverUserName :string) => {
      this.model.globalSettings.quiverUserName = quiverUserName;
      this.core.updateGlobalSettings(this.model.globalSettings);
      return this.login('Quiver', quiverUserName);
    });
  }

  public handleCopyPasteUrlData = (url: string) => {
    console.log('received one-time URL from browser');

    if (this.model.onlineNetworks.length > 0) {
      console.log('Ignoring URL since we have an active network');
      this.copyPasteState.error = ui_constants.CopyPasteError.LOGGED_IN;
      return;
    }

    if (social.SharingState.NONE !== this.copyPasteState.localSharingWithRemote) {
      console.info('should not be processing a URL while in the middle of sharing');
      this.copyPasteState.error = ui_constants.CopyPasteError.UNEXPECTED;
      return;
    }

    // do not use the updateView function here, actual state may not have been
    // processed yet
    this.view = ui_constants.View.COPYPASTE;
    this.copyPasteState.error = ui_constants.CopyPasteError.NONE;

    try {
      var parsed = this.parseUrlData(url);

      // at this point, we assume everything is good, so let's check state
      switch (parsed.type) {
        case social.PeerMessageType.SIGNAL_FROM_CLIENT_PEER:
          this.core.startCopyPasteShare();
          break;
        case social.PeerMessageType.SIGNAL_FROM_SERVER_PEER:
          if (social.GettingState.TRYING_TO_GET_ACCESS
              !== this.copyPasteState.localGettingFromRemote) {
            console.warn('currently not expecting any information, aborting');
            this.copyPasteState.error = ui_constants.CopyPasteError.UNEXPECTED;
            return;
          }
          break;
      }

      console.log('sending one-time string to app');
      this.core.sendCopyPasteSignal(parsed.message);
    } catch (e) {
      console.error('invalid one-time URL: ' + e.message);
      this.copyPasteState.error = ui_constants.CopyPasteError.BAD_URL;
    }
  }

  public proxyDisconnected = (info?:ProxyDisconnectInfo) => {
    if (this.isGettingAccess()) {
      this.stopGettingFromInstance(this.instanceGettingAccessFrom_);
      if (info && info.deliberate) {
        return;
      }
      this.fireSignal('open-proxy-error');
      this.bringUproxyToFront();
    }
  }

  public handleTranslationsRequest = (keys :string[], callback ?:Function) => {
    var vals :{[s :string]: string;} = {};
    for (let key of keys) {
      vals[key] = this.i18n_t(key);
    }
    this.browserApi.respond(vals, callback, 'translations');
  }

  public handleGlobalSettingsRequest = (callback ?:Function) => {
    this.browserApi.respond(this.model.globalSettings, callback, 'globalSettings');
  }

  public setActivePromoId = (promoId :string) => {
    this.model.globalSettings.activePromoId = promoId;
    this.core.updateGlobalSettings(this.model.globalSettings);
  }

  /**
   * Takes all actions required when getting stops, including removing proxy
   * indicators from the UI, and retrying the connection if appropriate.
   * If user didn't end proxying, so if proxy session ended because of some
   * unexpected reason, user should be asked before reverting proxy settings.
   * if data.instanceId is null, it means to stop active proxying.
   */
  public stoppedGetting = (data :social.StopProxyInfo) => {
    var instanceId = data.instanceId || this.instanceGettingAccessFrom_;

    if (instanceId === this.instanceGettingAccessFrom_) {
      this.instanceGettingAccessFrom_ = null;
    }

    if (instanceId) {
      this.mapInstanceIdToUser_[instanceId].isSharingWithMe = false;
    }

    if (data.error) {
      if (instanceId) {
        // Auto-retry.
        this.core.disconnectedWhileProxying = instanceId;
        this.restartProxying();
      } else {
        // this handles the case where it was a one-time connection
        this.core.disconnectedWhileProxying = 'unknown';
      }

      // regardless, let the user know
      this.bringUproxyToFront();
    } else {
      // Clear the browser proxy settings.  This is necessary in case the
      // proxy was stopped when the user was signed out of the social network.
      // In the case where the user clicked stop, this will have no effect
      // (this function is idempotent).
      this.browserApi.stopUsingProxy();
    }

    this.updateGettingStatusBar_();
    this.updateIcon_();
  }

  /**
   * Undoes proxy configuration (e.g. chrome.proxy settings).
   */
  public stopUsingProxy = (userCancelled ?:boolean) => {
    if (userCancelled) {
      this.userCancelledGetAttempt_ = true;
    }

    this.browserApi.stopUsingProxy();
    this.core.disconnectedWhileProxying = null;
    this.updateIcon_();

    // revertProxySettings might call stopUsingProxy while a reconnection is
    // still being attempted.  In that case, we also want to terminate the
    // in-progress connection.
    if (this.instanceTryingToGetAccessFrom) {
      this.stopGettingFromInstance(this.instanceTryingToGetAccessFrom);
    }
  }

  private getInstancePath_ = (instanceId :string) => {
    var user = this.mapInstanceIdToUser_[instanceId];

    return <social.InstancePath>{
      network: {
        name: user.network.name,
        userId: user.network.userId
      },
      userId: user.userId,
      instanceId: instanceId
    };
  }

  public restartProxying = () => {
    this.startGettingFromInstance(this.core.disconnectedWhileProxying);
  }

  public startGettingFromInstance = (instanceId :string) :Promise<void> => {
    this.instanceTryingToGetAccessFrom = instanceId;

    return this.core.start(this.getInstancePath_(instanceId))
        .then((endpoint :net.Endpoint) => {
      this.instanceTryingToGetAccessFrom = null;
      // If we were getting access from some other instance
      // turn down the connection.
      if (this.instanceGettingAccessFrom_ &&
          this.instanceGettingAccessFrom_ != instanceId) {
        this.core.stop(this.getInstancePath_(this.instanceGettingAccessFrom_));
      }
      this.startGettingInUiAndConfig(instanceId, endpoint);
    }, (err:Error) => {
      this.instanceTryingToGetAccessFrom = null;
      throw err;
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

    this.core.stop(this.getInstancePath_(instanceId));
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

    this.core.disconnectedWhileProxying = null;

    this.startGettingInUi();

    this.updateGettingStatusBar_();

    this.browserApi.startUsingProxy(endpoint,
        this.model.globalSettings.proxyBypass);
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
    } else if (this.model.onlineNetworks.length > 0 ||
        !this.browserApi.hasInstalledThenLoggedIn) {
      this.browserApi.setIcon(Constants.DEFAULT_ICON);
      this.updateBadgeNotification_();
      return;
    } else {
      this.browserApi.setIcon(Constants.LOGGED_OUT_ICON);
    }

    // For all icons except the default icon, do not show notifications.
    this.browserApi.setBadgeNotification('');
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
      (this.copyPasteState.localSharingWithRemote ===
         social.SharingState.SHARING_ACCESS);
  }

  /**
   * Synchronize a new network to be visible on this UI.
   */
  private syncNetwork_ = (networkMsg :social.NetworkMessage) => {
    var existingNetwork = this.model.getNetwork(networkMsg.name, networkMsg.userId);
    var displayName = this.getNetworkDisplayName(networkMsg.name);

    if (networkMsg.online) {
      if (!existingNetwork) {
        existingNetwork = {
          name: networkMsg.name,
          userId: networkMsg.userId,
          roster: {},
          logoutExpected: false,
          userName: networkMsg.userName,
          imageData: getImageData(networkMsg.userId, null, networkMsg.imageData)
        };
        this.model.onlineNetworks.push(existingNetwork);
      }
    } else {
      if (existingNetwork) {
        this.model.removeNetwork(networkMsg.name, networkMsg.userId);

        if (!existingNetwork.logoutExpected &&
            this.supportsReconnect_(networkMsg.name) &&
            !this.core.disconnectedWhileProxying && !this.instanceGettingAccessFrom_) {
          console.warn('Unexpected logout, reconnecting to ' + networkMsg.name);
          this.reconnect_(networkMsg.name);
        } else {
          this.showNotification(
            this.i18n_t('LOGGED_OUT', { network: displayName }));

          if (!this.model.onlineNetworks.length) {
            this.view = ui_constants.View.SPLASH;
          }
        }
      }
    }

    this.updateView_();
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
    network.userName = profile.name;
    network.imageData =
        getImageData(network.userId, network.imageData, profile.imageData);
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
      var gettingState = payload.offeringInstances[i].localGettingFromRemote;
      var instanceId = payload.offeringInstances[i].instanceId;
      if (gettingState === social.GettingState.GETTING_ACCESS) {
        this.startGettingInUiAndConfig(instanceId, payload.offeringInstances[i].activeEndpoint);
        break;
      } else if (gettingState === social.GettingState.TRYING_TO_GET_ACCESS) {
        this.instanceTryingToGetAccessFrom = instanceId;
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
    model.categorizeUser(user, this.model.contacts.getAccessContacts,
        oldUserCategories.getTab, newUserCategories.getTab);
    if (user.status != social.UserStatus.CLOUD_INSTANCE_SHARED_WITH_LOCAL) {
      model.categorizeUser(user, this.model.contacts.shareAccessContacts,
          oldUserCategories.shareTab, newUserCategories.shareTab);
    }

    this.updateBadgeNotification_();

    console.log('Synchronized user.', user);
  };

  /**
   * Remove a friend from the friend list by removing it from 
   * model.contacts
   */
  public removeFriend = (args:{ networkName: string, userId: string }) => {
    var network = this.model.getNetwork(args.networkName);
    var user = this.model.getUser(network, args.userId);
    this.model.removeContact(user);
    console.log('Removed user from contacts', user);
  }

  public getCloudUserCreatedByLocal = () : Promise<Object> => {
    const network = this.model.getNetwork('Cloud');
    if (!network) {
      return Promise.reject('not logged into cloud network');
    }
    for (let userId in network.roster) {
      let user = this.model.getUser(network, userId);
      if (user.status === social.UserStatus.CLOUD_INSTANCE_CREATED_BY_LOCAL) {
        return Promise.resolve(user);
      }
    }
    return Promise.reject('locally created cloud contact does not exist');
  }

  public openTab = (url: string) => {
    this.browserApi.openTab(url);
  }

  public bringUproxyToFront = () => {
    this.browserApi.bringUproxyToFront();
  }

  public login = (network :string, userName ?:string) : Promise<void> => {
    if (network === 'Cloud') {
      this.model.globalSettings.showCloud = true;
      this.core.updateGlobalSettings(this.model.globalSettings);
    }

    return this.core.login({
        network: network,
        loginType: uproxy_core_api.LoginType.INITIAL,
        userName: userName
    }).then(() => {
      this.browserApi.hasInstalledThenLoggedIn = true;
    }).catch((e :Error) => {
      this.showNotification(this.i18n_t(
          'ERROR_SIGNING_IN', {network: this.getNetworkDisplayName(network)}));
      throw e;
    });
  }

  private getLogoutConfirmation_ = (isGetting :boolean, isSharing :boolean) : Promise<void> => {
    if (isGetting && isSharing) {
      return this.getConfirmation(
          '', this.i18n_t('CONFIRM_LOGOUT_GETTING_AND_SHARING'));
    } else if (isGetting) {
      return this.getConfirmation('', this.i18n_t('CONFIRM_LOGOUT_GETTING'));
    } else if (isSharing) {
      return this.getConfirmation('', this.i18n_t('CONFIRM_LOGOUT_SHARING'));
    } else {
      return Promise.resolve<void>();
    }
  }

  public logout = (networkInfo :social.SocialNetworkInfo,
                   showConfirmation :boolean = true) : Promise<void> => {
    var network = this.model.getNetwork(networkInfo.name);
    // Check if the user is connected to a network
    if (!network) {
      // If the user is not connected to the network, then don't log him out,
      // you probably won't reach this point anyways. EVER. Probably.
      console.warn('User is trying to log out of not-logged-in-network ' +
                   networkInfo.name);
      return Promise.resolve<void>();
    }

    var getConfirmation = Promise.resolve<void>();
    if (showConfirmation) {
      // Check if we are getting or sharing on this network.
      var isGettingForThisNetwork = false;
      if (this.instanceGettingAccessFrom_) {
        var user = this.mapInstanceIdToUser_[this.instanceGettingAccessFrom_];
        if (user && user.network.name === networkInfo.name) {
          isGettingForThisNetwork = true;
        }
      }
      var isSharingForThisNetwork = false;
      var sharingTo = Object.keys(this.instancesGivingAccessTo);
      for (var i = 0; i < sharingTo.length; ++i) {
        user = this.mapInstanceIdToUser_[sharingTo[i]];
        if (user && user.network.name === networkInfo.name) {
          isSharingForThisNetwork = true;
          break;
        }
      }
      getConfirmation = this.getLogoutConfirmation_(
          isGettingForThisNetwork, isSharingForThisNetwork);
    }

    return getConfirmation.then(() => {
      network.logoutExpected = true;
      return this.core.logout(networkInfo);
    }, () => { /* MT */ });
  }

  public logoutAll = (showConfirmation :boolean) : Promise<void[]> => {
    var getConfirmation = Promise.resolve<void>();
    if (showConfirmation) {
      getConfirmation = this.getLogoutConfirmation_(
          this.isGettingAccess(), this.isGivingAccess());
    }

    return getConfirmation.then(() => {
      var logoutPromises :Promise<void>[] = [];
      for (var i in this.model.onlineNetworks) {
        logoutPromises.push(
            this.logout({
              name: this.model.onlineNetworks[i].name,
              userId: this.model.onlineNetworks[i].userId
            }, false)  // Don't show duplicate confirmation messages.
        );
      }
      return Promise.all(logoutPromises);
    }, () => { /* MT */ });
  }

  private reconnect_ = (network :string) => {
    this.model.reconnecting = true;
    // TODO: add wechat, quiver, github URLs
    var pingUrl = network == 'Facebook-Firebase-V2'
        ? 'https://graph.facebook.com' : 'https://www.googleapis.com';
    this.core.pingUntilOnline(pingUrl).then(() => {
      // Ensure that the user is still attempting to reconnect (i.e. they
      // haven't clicked to stop reconnecting while we were waiting for the
      // ping response).
      // TODO: this doesn't work quite right if the user is signed into multiple social networks
      if (this.model.reconnecting) {
        this.core.login({network: network, loginType: uproxy_core_api.LoginType.RECONNECT}).then(() => {
          // TODO: we don't necessarily want to hide the reconnect screen, as we might only be reconnecting to 1 of multiple disconnected networks
          this.stopReconnect();
        }).catch((e) => {
          // Reconnect failed, give up.
          // TODO: this may have only failed for 1 of multiple networks
          this.stopReconnect();
          this.showNotification(
              this.i18n_t('LOGGED_OUT', { network: network }));

          this.updateView_();
        });
      }
    });
  }

  public stopReconnect = () => {
    this.model.reconnecting = false;
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
        logs: logs,
        feedbackType: uproxy_core_api.UserFeedbackType[feedback.feedbackType],
        proxyingId: this.proxyingId
      };

      return this.core.postReport({payload: payload, path: 'submit-feedback'});
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
    this.model.cloudProviderNames = state.cloudProviderNames;
    this.availableVersion = state.availableVersion;
    if (state.globalSettings.language !== this.model.globalSettings.language) {
      this.updateLanguage(state.globalSettings.language);
    }
    this.model.updateGlobalSettings(state.globalSettings);

    // Maybe refactor this to be copyPasteState.
    this.copyPasteState.updateFromConnectionState(state.copyPasteConnection);

    while (this.model.onlineNetworks.length > 0) {
      var toRemove = this.model.onlineNetworks[0];

      this.model.removeNetwork(toRemove.name, toRemove.userId);
    }

    for (var network in state.onlineNetworks) {
      this.addOnlineNetwork_(state.onlineNetworks[network]);
    }

    if (state.onlineNetworks.length > 0) {
      // Check that we dont' have copy paste connection
      if (this.copyPasteState.localGettingFromRemote !== social.GettingState.NONE ||
          this.copyPasteState.localSharingWithRemote !== social.SharingState.NONE) {
        console.error(
            'User cannot be online while having a copy-paste connection');
      }
    }

    this.portControlSupport = state.portControlSupport;

    // plenty of state may have changed, update it
    this.updateView_();
    this.updateSharingStatusBar_();
    this.updateIcon_();
  }

  private addOnlineNetwork_ = (networkState :social.NetworkState) => {
    var profile = networkState.profile;
    this.model.onlineNetworks.push({
      name: networkState.name,
      userId: profile.userId,
      userName: profile.name,
      imageData: getImageData(profile.userId, null, profile.imageData),
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

  private updateBadgeNotification_ = () => {
    // Don't show notifications if the user is giving or getting access.
    if (this.isGivingAccess() || this.isGettingAccess()) {
      this.browserApi.setBadgeNotification('');
      return;
    }

    var numOfNotifications = this.model.contacts.getAccessContacts.pending.length +
        this.model.contacts.shareAccessContacts.pending.length;
    if (numOfNotifications === 0) {
      this.browserApi.setBadgeNotification('');
    } else {
      this.browserApi.setBadgeNotification(numOfNotifications.toString());
    }
  }

  private setPortControlSupport_ = (support:uproxy_core_api.PortControlSupport) => {
    this.portControlSupport = support;
  }

  public getNetworkDisplayName = (networkName :string) : string => {
    return this.getProperty_<string>(networkName, 'displayName') || networkName;
  }

  private supportsReconnect_ = (networkName :string) : boolean => {
    return this.getProperty_<boolean>(networkName, 'supportsReconnect') || false;
  }

  public isExperimentalNetwork = (networkName :string) : boolean => {
    return this.getProperty_<boolean>(networkName, 'isExperimental') || false;
  }

  private getProperty_ = <T>(networkName :string, propertyName :string) : T => {
    if (NETWORK_OPTIONS[networkName]) {
      return (<any>(NETWORK_OPTIONS[networkName]))[propertyName];
    }
    return undefined;
  }

  // this takes care of updating the view (given the assumuption that we are
  // connected to the core)
  private updateView_ = () => {
    if (this.model.onlineNetworks.length > 0 ||
        this.model.globalSettings.hasSeenWelcome) {
      this.view = ui_constants.View.ROSTER;
    } else if (this.copyPasteState.localGettingFromRemote !== social.GettingState.NONE ||
               this.copyPasteState.localSharingWithRemote !== social.SharingState.NONE) {
      this.view = ui_constants.View.COPYPASTE;
    } else {
      this.view = ui_constants.View.SPLASH;
    }
  }

  public i18nSanitizeHtml = (i18nMessage :string) => {
    // Remove all HTML other than supported tags like strong, a, p, etc.
    return i18nMessage.replace(/<((?!(\/?(strong|a|p|br|uproxy-faq-link)))[^>]+)>/g, '');
  }

  public cloudUpdate = (args :uproxy_core_api.CloudOperationArgs): Promise<void> => {
    return this.core.cloudUpdate(args);
  }

  public removeContact = (args:uproxy_core_api.RemoveContactArgs): Promise<void> => {
    return this.core.removeContact(args);
  }

  public startVerifying = (inst :social.InstanceData) :Promise<void> => {
    console.log('ui:startVerifying on ' + JSON.stringify(inst) +
                ' started.');
    return this.core.verifyUser(this.getInstancePath_(inst.instanceId));
  }
  public finishVerifying = (inst :social.InstanceData,
                            sameSAS: boolean) :Promise<void> => {
    var args :uproxy_core_api.FinishVerifyArgs = {
      'inst': this.getInstancePath_(inst.instanceId),
      'sameSAS': sameSAS
    };
    return this.core.finishVerifyUser(args);
  };
} // class UserInterface
