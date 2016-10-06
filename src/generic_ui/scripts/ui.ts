/// <reference path='../../../third_party/typings/index.d.ts' />
/// <reference path='../../../third_party/generic/jdenticon.d.ts' />
/// <reference path='../../../third_party/generic/jsurl.d.ts' />
/// <reference path='../../../third_party/generic/uparams.d.ts' />

/**
 * ui.ts
 *
 * Common User Interface state holder and changer.
 */

import * as _ from 'lodash';
import * as ui_constants from '../../interfaces/ui';
import * as background_ui from './background_ui';
import CoreConnector from './core_connector';
import * as uproxy_core_api from '../../interfaces/uproxy_core_api';
import * as browser_api from '../../interfaces/browser_api';
import ProxyAccessMode = browser_api.ProxyAccessMode;
import BrowserAPI = browser_api.BrowserAPI;
import ProxyDisconnectInfo = browser_api.ProxyDisconnectInfo;
import * as net from '../../lib/net/net.types';
import * as user_module from './user';
import User = user_module.User;
import * as social from '../../interfaces/social';
import * as Constants from './constants';
import * as translator_module from './translator';
import * as network_options from '../../generic/network-options';
import * as model from './model';
import * as dialogs from './dialogs';
import * as jsurl from 'jsurl';
import uparams from 'uparams';
import * as crypto from 'crypto';
import * as jdenticon from 'jdenticon';

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

export function getImageData(userId: string, oldImageData: string,
                             newImageData: string): string {
  if (newImageData) {
    return newImageData;
  } else if (oldImageData) {
    // This case is hit when we've already generated a jdenticon for a user
    // who doesn't have any image in uProxy core.
    return oldImageData;
  }

  // Extra single-quotes are needed for CSS/Polymer parsing.  This is safe
  // as long as jdenticon only uses '"' in the generated code...
  // The size is arbitrarily set to 100 pixels.  SVG is scalable and our CSS
  // scales the image to fit the space, so this parameter has no effect.
  // We must also replace # with %23 for Firefox support.
  const userIdHash = crypto.createHash('md5').update(userId).digest('hex');
  return '\'data:image/svg+xml;utf8,' +
      jdenticon.toSvg(userIdHash, 100).replace(/#/g, '%23') + '\'';
}


/* Suppress `error TS2339: Property 'languages' does not exist on type
 * 'Navigator'` triggered by `navigator.languages` reference below.
 */
declare var navigator :any;

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
  public isSharingDisabled :boolean = false;
  public proxyingId: string; // ID of the most recent failed proxying attempt.
  private userCancelledGetAttempt_ :boolean = false;

  /* Translation */
  public i18n_t = translator_module.i18n_t;
  public i18n_setLng = translator_module.i18n_setLng;
  public i18nSanitizeHtml = translator_module.i18nSanitizeHtml;

  /* About this uProxy installation */
  public availableVersion :string = null;

  // Please note that this value is updated periodically so may not reflect current reality.
  private isConnectedToCellular_ :boolean = false;

  // User-initiated proxy access mode. Set when starting the proxy in order to
  // stop it accordingly, and to automatically restart proxying in case of a
  // disconnect.
  private proxyAccessMode_: ProxyAccessMode = ProxyAccessMode.NONE;

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
      this.showNotification(translator_module.i18n_t('STARTED_PROXYING',
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
        this.showNotification(translator_module.i18n_t('STOPPED_PROXYING',
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

      let toastMessage = translator_module.i18n_t('UNABLE_TO_SHARE_WITH', { name: info.name });
      this.backgroundUi.showToast(toastMessage, false, true);
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
            let toastMessage = translator_module.i18n_t('UNABLE_TO_GET_FROM', { name: info.name });
            this.backgroundUi.showToast(toastMessage, true, false);
          }
        }
      }
      this.instanceTryingToGetAccessFrom = null;
      this.proxyingId = info.proxyingId;
      this.bringUproxyToFront();
    });

    core.onUpdate(uproxy_core_api.Update.CORE_UPDATE_AVAILABLE, this.coreUpdateAvailable_);

    core.onUpdate(uproxy_core_api.Update.CLOUD_INSTALL_STATUS, (status: string) => {
      this.fireSignal('cloud-install-status', status);
    });

    core.onUpdate(uproxy_core_api.Update.CLOUD_INSTALL_PROGRESS, (progress: number) => {
      this.fireSignal('cloud-install-progress', progress);
    });

    core.onUpdate(
        uproxy_core_api.Update.REFRESH_GLOBAL_SETTINGS,
        (globalSettings: uproxy_core_api.GlobalSettings) => {
          this.model.updateGlobalSettings(globalSettings);
    });

    core.onUpdate(uproxy_core_api.Update.REPROXY_ERROR, () => {
        this.model.reproxyError = true;
        var intervalId = setInterval(() => {
          if (!this.model.reproxyError) {
            // Reproxy fixed
            clearInterval(intervalId);
            return;
          }
          // Check reproxy
          this.core.checkReproxy(this.model.globalSettings.reproxy.socksEndpoint.port)
            .then((check :uproxy_core_api.ReproxyCheck) => {
              if (check === uproxy_core_api.ReproxyCheck.TRUE) {
                this.model.reproxyError = false;
              }
            });
        }, 10000);
    });

    core.onUpdate(uproxy_core_api.Update.REPROXY_WORKING, () => {
        this.model.reproxyError = false;
    });

    browserApi.on('inviteUrlData', this.handleInvite);
    browserApi.on('notificationClicked', this.handleNotificationClick);
    browserApi.on('proxyDisconnected', this.proxyDisconnected);
    browserApi.on('promoIdDetected', this.setActivePromoId);
    browserApi.on('translationsRequest', this.handleTranslationsRequest);
    browserApi.on('globalSettingsRequest', this.handleGlobalSettingsRequest);
    browserApi.on('backbutton', () => {
      this.fireSignal('backbutton');
    });
    backgroundUi.registerAsFakeBackground(this.panelMessageHandler);

    core.getFullState()
        .then(this.updateInitialState)
        .then(this.browserApi.handlePopupLaunch);
  }

  public panelMessageHandler = (name: string, data: any) => {
    /*
     * This will handle a subset of the signals for the actual background UI,
     * we will try to handle most of the signals in the actual background
     * though
     */
    switch(name) {
      /* holding for more operations as needed */
    }
  }

  public restartServer_ = (providerName :string) => {
    this.getConfirmation(
      this.i18n_t('RESTART_SERVER_TITLE'),
      this.i18n_t('RESTART_SERVER_TEXT'),
      this.i18n_t('CANCEL'),
      this.i18n_t('RESTART_SERVER')
    ).then(() => {
      this.backgroundUi.showToast(translator_module.i18n_t('RESTARTING_SERVER'));
      return this.core.cloudUpdate({
        operation: uproxy_core_api.CloudOperationType.CLOUD_REBOOT,
        providerName: providerName
      }).then(() => {
        this.backgroundUi.showToast(translator_module.i18n_t('RESTART_SUCCESS'));
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

  public getConfirmation(heading :string,
                         text :string,
                         dismissButtonText ?:string,
                         fulfillButtonText ?:string): Promise<void> {
    return this.backgroundUi.openDialog(dialogs.getConfirmationDialogDescription(
        heading, text, dismissButtonText, fulfillButtonText));
  }

  public getUserInput(heading :string, message :string, placeholderText :string, defaultValue :string, buttonText :string) : Promise<string> {
    return this.backgroundUi.openDialog(dialogs.getInputDialogDescription(
        heading, message, placeholderText, defaultValue, buttonText));
  }

  public showDialog(heading :string, message :string, buttonText ?:string,
      displayData ?:string) {
    return this.backgroundUi.openDialog(dialogs.getMessageDialogDescription(
        heading, message, buttonText, displayData));
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
        this.updateGlobalSetting('mode', ui_constants.Mode.GET);
        if (contact) {
          contact.getExpanded = true;
        }
      } else if (data.mode === 'share' && !this.isSharingDisabled) {
        this.updateGlobalSetting('mode', ui_constants.Mode.SHARE);
        if (contact) {
          contact.shareExpanded = true;
        }
      }
    } catch (e) {
      console.warn('error getting information from notification tag');
    }
  }

  private updateGettingStatusBar_ = () => {
    var gettingStatus: string = null;
    if (this.instanceGettingAccessFrom_) {
      gettingStatus = this.i18n_t('GETTING_ACCESS_FROM', {
        name: this.mapInstanceIdToUser_[this.instanceGettingAccessFrom_].name
      });
    }
    this.fireSignal('update-getting-status', gettingStatus);
  }

  private updateSharingStatusBar_ = () => {
    // TODO: localize this - may require simpler formatting to work
    // in all languages.
    var sharingStatus: string = null;
    var instanceIds = Object.keys(this.instancesGivingAccessTo);
    if (instanceIds.length === 1) {
      sharingStatus = this.i18n_t('SHARING_ACCESS_WITH_ONE', {
        name: this.mapInstanceIdToUser_[instanceIds[0]].name
      });
    } else if (instanceIds.length === 2) {
      sharingStatus = this.i18n_t('SHARING_ACCESS_WITH_TWO', {
        name1: this.mapInstanceIdToUser_[instanceIds[0]].name,
        name2: this.mapInstanceIdToUser_[instanceIds[1]].name
      });
    } else if (instanceIds.length > 2) {
      sharingStatus = this.i18n_t('SHARING_ACCESS_WITH_MANY', {
        name: this.mapInstanceIdToUser_[instanceIds[0]].name,
        numOthers: (instanceIds.length - 1)
      });
    }
    this.fireSignal('update-sharing-status', sharingStatus);
  }

  private addUser_ = (tokenObj :social.InviteTokenData, showConfirmation :boolean) : Promise<void> => {
    try {
      var userName = tokenObj.userName;
      var networkName = tokenObj.networkName;
    } catch(e) {
      return Promise.reject('Error parsing invite token');
    }

    var getConfirmation = Promise.resolve();
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
        var token = invite.substring(lastNonCodeCharacter + 1);

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
      var loginPromise = Promise.resolve();
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
      this.updateGlobalSetting('quiverUserName', quiverUserName);
      return this.login('Quiver', quiverUserName);
    });
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
    this.updateGlobalSetting('activePromoId', promoId);
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
        console.error('Received error on getting without a current instance');
      }

      // regardless, let the user know
      this.bringUproxyToFront();
    } else if (this.instanceGettingAccessFrom_ === null &&
               this.instanceTryingToGetAccessFrom === null) {
      // Clear the browser proxy settings only if there is no active connection.
      // Otherwise, this is a connection handover and clearing the proxy
      // settings will interrupt the active session.
      // This is necessary in case the proxy was stopped when the user was
      // signed out of the social network. In the case where the user clicked
      // stop, this will have no effect (this function is idempotent).
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
    this.startGettingFromInstance(this.core.disconnectedWhileProxying,
                                  this.proxyAccessMode_);
  }

  public startGettingFromInstance =
      (instanceId :string, accessMode: ProxyAccessMode): Promise<void> => {
    if (this.instanceTryingToGetAccessFrom !== null) {
      // Cancel the existing proxying attempt before starting a new connection.
      this.userCancelledGetAttempt_ = true;
      this.core.stop(this.getInstancePath_(this.instanceTryingToGetAccessFrom));
    }
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
      // Remember access mode in case of reconnect.
      this.proxyAccessMode_ = accessMode;
      this.startGettingInUiAndConfig(instanceId, endpoint, accessMode);
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
      (instanceId :string, endpoint :net.Endpoint, accessMode: ProxyAccessMode) => {
    if (instanceId) {
      this.instanceGettingAccessFrom_ = instanceId;
      this.mapInstanceIdToUser_[instanceId].isSharingWithMe = true;
    }

    if (!accessMode || accessMode === ProxyAccessMode.NONE) {
      console.error('Cannot start using proxy: unknown proxy acccess mode.');
      return;
    }

    this.core.disconnectedWhileProxying = null;

    this.startGettingInUi();

    this.updateGettingStatusBar_();

    this.browserApi.startUsingProxy(endpoint,
        this.model.globalSettings.proxyBypass, {accessMode: accessMode});
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
    return Object.keys(this.instancesGivingAccessTo).length > 0;
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
        this.startGettingInUiAndConfig(
            instanceId, payload.offeringInstances[i].activeEndpoint,
            this.proxyAccessMode_);
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
    this.updateGlobalSetting('mode', mode);
  }

  public updateLanguage = (newLanguage :string) => {
    this.updateGlobalSetting('language', newLanguage);
    this.i18n_setLng(newLanguage);
    this.model.globalSettings.language = newLanguage;
  }

  public updateInitialState = (state :uproxy_core_api.InitialState) => {
    console.log('Received uproxy_core_api.Update.INITIAL_STATE:', state);
    this.model.networkNames = state.networkNames;
    this.model.cloudProviderNames = state.cloudProviderNames;
    this.availableVersion = state.availableVersion;
    if (!state.globalSettings.language) {
      // Set state.globalSettings.language based on browser settings:
      // Choose the first language in navigator.languages we have available.
      let lang :string;
      try {
        lang = _(navigator.languages).map((langCode :string) => {
          return langCode.substring(0, 2).toLowerCase();  // Normalize
        }).find((langCode :string) => {  // Return first lang we have available.
          return _.includes(translator_module.i18n_languagesAvailable, langCode);
        });
      } catch (e) {
        lang = 'en';
      }
      state.globalSettings.language = lang || 'en';
    }
    if (state.globalSettings.language !== this.model.globalSettings.language) {
      this.updateLanguage(state.globalSettings.language);
    }
    this.model.updateGlobalSettings(state.globalSettings);

    while (this.model.onlineNetworks.length > 0) {
      var toRemove = this.model.onlineNetworks[0];

      this.model.removeNetwork(toRemove.name, toRemove.userId);
    }

    for (var network in state.onlineNetworks) {
      this.addOnlineNetwork_(state.onlineNetworks[network]);
    }

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

  public getNetworkDisplayName = (networkName :string) : string => {
    return this.getProperty_<string>(networkName, 'displayName') || networkName;
  }

  private supportsReconnect_ = (networkName :string) : boolean => {
    return this.getProperty_<boolean>(networkName, 'supportsReconnect') || false;
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
    } else {
      this.view = ui_constants.View.SPLASH;
    }
  }

  public cloudUpdate = (args :uproxy_core_api.CloudOperationArgs)
      :Promise<uproxy_core_api.CloudOperationResult> => {
    return this.core.cloudUpdate(args);
  }

  public removeContact = (args:uproxy_core_api.RemoveContactArgs): Promise<void> => {
    return this.core.removeContact(args);
  }

  public startVerifying = (inst :social.InstanceData) :Promise<void> => {
    console.log('ui:startVerifying on ' + JSON.stringify(inst) +
                ' started.');
    // TODO: when doing the final UI, we need something that we can
    // cancel.  For user cancellation, peer cancellation, and timeout.
    return this.getConfirmation(
      'Verify this User',
      'Please contact them personally, live.  Preferably on a voice ' +
        'or video chat.  Then press Next',
      'Do this later', 'I\'m Ready').then( () => {
        // TODO: this really just needs a cancel button.
        this.getUserInput(
          'Verify this User',
          'Please type in the SAS code that they see for you.  Any other ' +
            'value cancels.',
          'SAS:', '', 'Next').then( (sas:string) => {
            console.log('Got SAS: ' + sas + ', against desired: ' +
                        inst.verifySAS);
            this.finishVerifying(inst,
                                 parseInt(inst.verifySAS) === parseInt(sas));
          });
        return this.core.verifyUser(this.getInstancePath_(inst.instanceId));
      });
  }

  public finishVerifying = (inst :social.InstanceData,
                            sameSAS: boolean) :Promise<void> => {
    var args :uproxy_core_api.FinishVerifyArgs = {
      'inst': this.getInstancePath_(inst.instanceId),
      'sameSAS': sameSAS
    };
    console.log('VERIFYING SAS AS ' + sameSAS);
    return this.core.finishVerifyUser(args);
  };

  private updateGlobalSetting = (setting: string, value: Object) => {
    (<any>this.model.globalSettings)[setting] = value;
    this.core.updateGlobalSetting({ name: setting, value: value });
  }

} // class UserInterface
