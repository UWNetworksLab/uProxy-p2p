/**
 * user.ts
 *
 * This is the UI-specific representation of a User.
 */
/// <reference path='../../../../third_party/freedom-typings/social.d.ts' />
/// <reference path='../../../../third_party/typings/lodash/lodash.d.ts' />

import social = require('../../interfaces/social');
import user_interface = require('./ui');
import translator_module = require('./translator');
import _ = require('lodash');

var i18n_t = translator_module.i18n_t;

export enum GettingConsentState {
  LOCAL_REQUESTED_REMOTE_GRANTED = 100,
  LOCAL_REQUESTED_REMOTE_NO_ACTION,
  REMOTE_OFFERED_LOCAL_NO_ACTION,
  REMOTE_OFFERED_LOCAL_IGNORED,
  NO_OFFER_OR_REQUEST
}

export enum SharingConsentState {
  LOCAL_OFFERED_REMOTE_ACCEPTED = 200,
  LOCAL_OFFERED_REMOTE_NO_ACTION,
  REMOTE_REQUESTED_LOCAL_NO_ACTION,
  REMOTE_REQUESTED_LOCAL_IGNORED,
  NO_OFFER_OR_REQUEST
}

/**
 * UI-specific user.
 */
export class User implements social.BaseUser {

  public name              :string;
  public imageData         :string;
  public url               :string;
  public isGettingFromMe   :boolean = false;
  public isSharingWithMe   :boolean = false;
  // 'filter'-related flags which indicate whether the user should be
  // currently visible in the UI.
  public offeringInstances :social.InstanceData[] = [];
  public allInstanceIds :string[] = [];

  public getExpanded :boolean = false;
  public shareExpanded :boolean = false;

  private consent_ :social.ConsentState;
  public gettingConsentState :GettingConsentState =
      GettingConsentState.NO_OFFER_OR_REQUEST;
  public sharingConsentState :SharingConsentState =
      SharingConsentState.NO_OFFER_OR_REQUEST;

  private isOnline_ :boolean = false;

  /**
   * Initialize the user to an 'empty' default.
   */
  constructor(public userId :string, public network :user_interface.Network,
      private ui_ :user_interface.UserInterface) {
    console.log('new user: ' + this.userId);
    this.name = '';
    this.offeringInstances = [];
  }

  /**
   * Update user details.
   */
  public update = (payload :social.UserData) => {
    var profile :social.UserProfileMessage = payload.user;
    if (this.userId !== profile.userId) {
      console.error('Unexpected userId: ' + profile.userId);
    }

    // if we do not have stored state, no use in checking for changes
    if (this.consent_) {
      // notifications for get mode
      if (!payload.consent.ignoringRemoteUserOffer) {
        if (this.offeringInstances.length === 0 && payload.offeringInstances.length > 0) {
          if (payload.consent.localRequestsAccessFromRemote) {
            this.ui_.showNotification(i18n_t('grantedAccessNotification', {name: profile.name}),
                         { mode: 'get', user: this.userId });
          } else {
            this.ui_.showNotification(i18n_t('offeredAccessNotification', {name: profile.name}),
                         { mode: 'get', user: this.userId });
          }
        }
      }

      // notifications for share mode
      if (!payload.consent.ignoringRemoteUserRequest) {
        if (!this.consent_.remoteRequestsAccessFromLocal && payload.consent.remoteRequestsAccessFromLocal) {
          if (payload.consent.localGrantsAccessToRemote) {
            this.ui_.showNotification(i18n_t('acceptedOfferNotification', {name: profile.name}),
                         { mode: 'share', user: this.userId });
          } else {
            this.ui_.showNotification(i18n_t('requestingAccessNotification', {name: profile.name}),
                         { mode: 'share', user: this.userId });
          }
        }
      }
    }

    this.name = profile.name;
    this.imageData = profile.imageData || user_interface.DEFAULT_USER_IMG;
    this.url = profile.url;

    // iterate backwards to allow removing elements
    var i = this.offeringInstances.length;
    while (i--) {
      var found = _.findIndex(payload.offeringInstances, (obj) => {
        return obj.instanceId === this.offeringInstances[i].instanceId;
      });

      if (found !== -1) {
        _.merge(this.offeringInstances[i], payload.offeringInstances[found]);
        payload.offeringInstances.splice(found, 1);
      } else {
        this.offeringInstances.splice(i, 1);
      }
    }

    for (var j in payload.offeringInstances) {
      this.offeringInstances.push(payload.offeringInstances[j]);
    }

    //this.offeringInstances = payload.offeringInstances;
    this.allInstanceIds = payload.allInstanceIds;
    this.updateInstanceDescriptions();
    this.consent_ = payload.consent;
    this.isOnline_ = payload.isOnline;

    // Update gettingConsentState, used to display correct getting buttons.
    if (this.offeringInstances.length > 0) {
      // Expand the contact if there previously were no offers and we are not
      // ignoring offers.
      if ((this.gettingConsentState ==
          GettingConsentState.NO_OFFER_OR_REQUEST ||
          this.gettingConsentState ==
          GettingConsentState.LOCAL_REQUESTED_REMOTE_NO_ACTION) &&
          !this.consent_.ignoringRemoteUserOffer) {
        this.getExpanded = true;
      }
      if (this.consent_.localRequestsAccessFromRemote) {
        this.gettingConsentState =
            GettingConsentState.LOCAL_REQUESTED_REMOTE_GRANTED;
      } else if (this.consent_.ignoringRemoteUserOffer) {
        this.gettingConsentState =
            GettingConsentState.REMOTE_OFFERED_LOCAL_IGNORED;
      } else {
        this.gettingConsentState =
            GettingConsentState.REMOTE_OFFERED_LOCAL_NO_ACTION;
      }
    } else {
      if (this.consent_.localRequestsAccessFromRemote) {
        this.gettingConsentState =
            GettingConsentState.LOCAL_REQUESTED_REMOTE_NO_ACTION;
      } else {
        this.gettingConsentState = GettingConsentState.NO_OFFER_OR_REQUEST;
      }
    }

    // Update sharingConsentState, used to display correct sharing buttons.
    if (this.consent_.remoteRequestsAccessFromLocal) {
      // Expand the contact if there previously were no requests and we are not
      // ignoring requests.
      if ((this.sharingConsentState ==
          SharingConsentState.NO_OFFER_OR_REQUEST ||
          this.sharingConsentState ==
          SharingConsentState.LOCAL_OFFERED_REMOTE_NO_ACTION) &&
          !this.consent_.ignoringRemoteUserRequest) {
        this.shareExpanded = true;
      }
      if (this.consent_.localGrantsAccessToRemote) {
        this.sharingConsentState =
            SharingConsentState.LOCAL_OFFERED_REMOTE_ACCEPTED;
      } else if (this.consent_.ignoringRemoteUserRequest) {
        this.sharingConsentState =
            SharingConsentState.REMOTE_REQUESTED_LOCAL_IGNORED;
      } else {
        this.sharingConsentState =
            SharingConsentState.REMOTE_REQUESTED_LOCAL_NO_ACTION;
      }
    } else {
      if (this.consent_.localGrantsAccessToRemote) {
        this.sharingConsentState =
            SharingConsentState.LOCAL_OFFERED_REMOTE_NO_ACTION;
      } else {
        this.sharingConsentState = SharingConsentState.NO_OFFER_OR_REQUEST;
      }
    }
  }

  // Returns two strings, where each matches an array name in model.contacts.
  // Does not use an enum because we need a string value, and typescript
  // enums evaluate to numbers.
  // CONSIDER: Avoid strings for values and string-param dependencies
  // https://github.com/uProxy/uproxy/issues/769
  public getCategories = () : user_interface.UserCategories => {
    var isTrustedForSharing = false;
    var isTrustedForGetting = false;
    var isPendingForSharing = false;
    var isPendingForGetting = false;

    // Share tab.
    if (this.consent_.remoteRequestsAccessFromLocal &&
        !this.consent_.ignoringRemoteUserRequest &&
        !this.consent_.localGrantsAccessToRemote) {
      isPendingForSharing = true;
    }
    if (this.consent_.localGrantsAccessToRemote) {
      isTrustedForSharing = true;
    }

    // Get tab.
    if (this.offeringInstances.length > 0) {
      if (this.consent_.localRequestsAccessFromRemote) {
        // we have asked for and received access
        isTrustedForGetting = true;
      } else if (!this.consent_.ignoringRemoteUserOffer) {
        // we have been offered access and have taken no action
        isPendingForGetting = true;
      }
    }

    // Convert booleans into strings.
    var isOnlineString = this.isOnline_ ? 'online' : 'offline';
    var gettingTrustString = 'UntrustedUproxy';
    if (isPendingForGetting) {
      gettingTrustString = 'Pending';
    } else if (isTrustedForGetting) {
      gettingTrustString = 'TrustedUproxy';
    }
    var sharingTrustString = 'UntrustedUproxy';
    if (isPendingForSharing) {
      sharingTrustString = 'Pending';
    } else if (isTrustedForSharing) {
      sharingTrustString = 'TrustedUproxy';
    }

    return {
      getTab: isOnlineString + gettingTrustString,
      shareTab: isOnlineString + sharingTrustString
    };
  }

  public updateInstanceDescriptions = () => {
    if (this.offeringInstances.length <= 1) {
      // Leave descriptions unchanged if there are 0 or 1 instances.
      return;
    }
    for (var i = 0; i < this.offeringInstances.length; ++i) {
      var instance = this.offeringInstances[i];
      if (!instance.description) {
        // Set description to "Computer 1", "Computer 2", etc.
        instance.description = i18n_t('descriptionDefault', {number: i + 1});
      }
    }
  }
}
