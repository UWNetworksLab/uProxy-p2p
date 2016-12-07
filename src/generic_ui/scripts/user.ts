/**
 * user.ts
 *
 * This is the UI-specific representation of a User.
 */

import * as model from './model';
import * as social from '../../interfaces/social';
import * as user_interface from './ui';
import * as translator_module from './translator';
import * as _ from 'lodash';
import * as Constants from './constants';

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
  public status            :social.UserStatus;
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

  public isOnline :boolean = false;

  /**
   * Initialize the user to an 'empty' default.
   */
  constructor(public userId :string, public network :model.Network,
      private ui_ :user_interface.UserInterface) {
    console.log('new user: ' + this.userId);
    this.name = '';
    this.offeringInstances = [];
  }

  /**
   * Update user details.  Does not alter its argument.
   */
  public update = (payload :social.UserData) => {
    var profile :social.UserProfileMessage = payload.user;
    if (this.userId !== profile.userId) {
      console.error('Unexpected userId: ' + profile.userId);
    }

    // We want to make it obvious that cloud friends are sharable to others.
    // Normally, friends will only have share expanded if they are requesting
    // access, but that will never be the case for a cloud server.
    if (!this.status && profile.status === social.UserStatus.CLOUD_INSTANCE_CREATED_BY_LOCAL) {
      this.shareExpanded = true;
    }

    this.name = profile.name;
    this.url = profile.url;
    this.status = profile.status;

    // check whether to show notifications if we have previous state and it's
    // not another instance of us
    if (this.consent_ && this.userId !== this.network.userId) {
      this.showNotificationsFromUpdate_(payload);
    }

    this.imageData = user_interface.getImageData(this.userId, this.imageData,
                                                 profile.imageData);

    this.mergeOfferingInstances_(payload.offeringInstances);

    this.allInstanceIds = payload.allInstanceIds;
    this.updateInstanceDescriptions_();
    this.consent_ = payload.consent;
    this.isOnline = payload.isOnline;

    if (this.shouldGetBeExpanded_()) {
      this.getExpanded = true;
    }

    if (this.shouldShareBeExpanded_()) {
      this.shareExpanded = true;
    }

    this.gettingConsentState = this.calculateGettingConsentState_();
    this.sharingConsentState = this.calculateSharingConsentState_();
  }

  private showNotificationsFromUpdate_ = (payload: social.UserData): void => {
    // notifications for get mode
    if (!payload.consent.ignoringRemoteUserOffer) {
      if (this.offeringInstances.length === 0 && payload.offeringInstances.length > 0) {
        if (payload.consent.localRequestsAccessFromRemote) {
          this.ui_.showNotification(i18n_t('GRANTED_ACCESS_NOTIFICATION', {name: payload.user.name}),
              { mode: 'get', network: this.network.name, user: this.userId });
        } else {
          this.ui_.showNotification(i18n_t('OFFERED_ACCESS_NOTIFICATION', {name: payload.user.name}),
              { mode: 'get', network: this.network.name, user: this.userId });
        }
      }
    }

    // notifications for share mode
    if (!payload.consent.ignoringRemoteUserRequest) {
      if (!this.consent_.remoteRequestsAccessFromLocal && payload.consent.remoteRequestsAccessFromLocal) {
        if (payload.consent.localGrantsAccessToRemote) {
          this.ui_.showNotification(i18n_t('ACCEPTED_OFFER_NOTIFICATION', {name: payload.user.name}),
              { mode: 'share', network: this.network.name, user: this.userId });
        } else {
          this.ui_.showNotification(i18n_t('REQUESTING_ACCESS_NOTIFICATION', {name: payload.user.name}),
              { mode: 'share', network: this.network.name, user: this.userId });
        }
      }
    }
  }

  private mergeOfferingInstances_ = (newOfferingInstances: social.InstanceData[]): void => {
    // Work with a shallow copy of the new instances, so that we can safely
    // delete entries that have been processed for easier bookkeeping.
    newOfferingInstances = newOfferingInstances.slice();
    // iterate backwards to allow removing elements
    var i = this.offeringInstances.length;
    while (i--) {
      let found = _.findIndex(newOfferingInstances, (obj) => {
        return obj.instanceId === this.offeringInstances[i].instanceId;
      });

      if (found !== -1) {
        _.merge(this.offeringInstances[i], newOfferingInstances[found]);
        newOfferingInstances.splice(found, 1);
      } else {
        this.offeringInstances.splice(i, 1);
      }
    }

    for (let j in newOfferingInstances) {
      this.offeringInstances.push(newOfferingInstances[j]);
    }
  }

  private shouldGetBeExpanded_ = (): boolean => {
    return this.offeringInstances.length > 0 &&
        (this.gettingConsentState ==
          GettingConsentState.NO_OFFER_OR_REQUEST ||
          this.gettingConsentState ==
          GettingConsentState.LOCAL_REQUESTED_REMOTE_NO_ACTION) &&
          !this.consent_.ignoringRemoteUserOffer && this.isOnline;
  }

  private calculateGettingConsentState_ = (): GettingConsentState => {
    if (this.network.name == 'Cloud') {
      return GettingConsentState.LOCAL_REQUESTED_REMOTE_GRANTED;
    }
    if (this.offeringInstances.length > 0) {
      // there is an instance offering access to us
      if (this.consent_.localRequestsAccessFromRemote) {
        return GettingConsentState.LOCAL_REQUESTED_REMOTE_GRANTED;
      } else if (this.consent_.ignoringRemoteUserOffer) {
        return GettingConsentState.REMOTE_OFFERED_LOCAL_IGNORED;
      } else {
        return GettingConsentState.REMOTE_OFFERED_LOCAL_NO_ACTION;
      }
    } else {
      if (this.consent_.localRequestsAccessFromRemote) {
        return GettingConsentState.LOCAL_REQUESTED_REMOTE_NO_ACTION;
      } else {
        return GettingConsentState.NO_OFFER_OR_REQUEST;
      }
    }
  }

  private shouldShareBeExpanded_ = (): boolean => {
    // Expand the contact if there previously were no requests, we are not
    // ignoring requests, and the contact is online.
    return this.consent_.remoteRequestsAccessFromLocal &&
        (this.sharingConsentState ==
          SharingConsentState.NO_OFFER_OR_REQUEST ||
          this.sharingConsentState ==
          SharingConsentState.LOCAL_OFFERED_REMOTE_NO_ACTION) &&
          !this.consent_.ignoringRemoteUserRequest && this.isOnline;
  }

  private calculateSharingConsentState_ = (): SharingConsentState => {
    if (this.consent_.remoteRequestsAccessFromLocal) {
      if (this.consent_.localGrantsAccessToRemote) {
        return SharingConsentState.LOCAL_OFFERED_REMOTE_ACCEPTED;
      } else if (this.consent_.ignoringRemoteUserRequest) {
        return SharingConsentState.REMOTE_REQUESTED_LOCAL_IGNORED;
      } else {
        return SharingConsentState.REMOTE_REQUESTED_LOCAL_NO_ACTION;
      }
    } else {
      if (this.consent_.localGrantsAccessToRemote) {
        return SharingConsentState.LOCAL_OFFERED_REMOTE_NO_ACTION;
      } else {
        return SharingConsentState.NO_OFFER_OR_REQUEST;
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
    var gettingTrustString = 'untrustedUproxy';
    if (isPendingForGetting) {
      gettingTrustString = 'pending';
    } else if (isTrustedForGetting) {
      gettingTrustString = 'trustedUproxy';
    }
    var sharingTrustString = 'untrustedUproxy';
    if (isPendingForSharing) {
      sharingTrustString = 'pending';
    } else if (isTrustedForSharing) {
      sharingTrustString = 'trustedUproxy';
    }

    return {
      getTab: gettingTrustString,
      shareTab: sharingTrustString
    };
  }

  private updateInstanceDescriptions_ = () => {
    if (this.offeringInstances.length <= 1) {
      // Leave descriptions unchanged if there are 0 or 1 instances.
      return;
    }
    for (var i = 0; i < this.offeringInstances.length; ++i) {
      var instance = this.offeringInstances[i];
      if (!instance.description) {
        // Set description to "Computer 1", "Computer 2", etc.
        instance.description = i18n_t('DESCRIPTION_DEFAULT', {number: i + 1});
      }
    }
  }
}
