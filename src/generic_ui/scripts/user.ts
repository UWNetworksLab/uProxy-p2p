/**
 * user.ts
 *
 * This is the UI-specific representation of a User.
 */
/// <reference path='../../freedom/typings/social.d.ts' />
/// <reference path='../../interfaces/user.d.ts' />

module UI {

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
  export class User implements BaseUser {

    public name              :string;
    public imageData         :string;
    public isGettingFromMe   :boolean = false;
    public isSharingWithMe   :boolean = false;
    // 'filter'-related flags which indicate whether the user should be
    // currently visible in the UI.
    public offeringInstances :UI.Instance[];
    public allInstanceIds :string[];

    private userConsent_ :uProxy.UserConsentState;
    public gettingConsentState :UI.GettingConsentState =
        GettingConsentState.NO_OFFER_OR_REQUEST;
    public sharingConsentState :UI.SharingConsentState =
        SharingConsentState.NO_OFFER_OR_REQUEST;

    private isOnline_ :boolean = false;

    /**
     * Initialize the user to an 'empty' default.
     */
    constructor(public userId :string, public network :UI.Network) {
      console.log('new user: ' + this.userId);
      this.name = '';
      this.offeringInstances = [];
    }

    /**
     * Update user details.
     */
    public update = (payload :UI.UserMessage) => {
      var profile :UI.UserProfileMessage = payload.user;
      if (this.userId !== profile.userId) {
        console.error('Unexpected userId: ' + profile.userId);
      }
      this.name = profile.name;
      this.imageData = profile.imageData || UI.DEFAULT_USER_IMG;
      this.offeringInstances = payload.offeringInstances;
      this.allInstanceIds = payload.allInstanceIds;
      this.updateInstanceDescriptions();
      this.userConsent_ = payload.userConsent;
      this.isOnline_ = payload.isOnline;

      // Update gettingConsentState, used to display correct getting buttons.
      if (this.offeringInstances.length > 0) {
        if (this.userConsent_.localRequestsAccessFromRemote) {
          this.gettingConsentState =
              GettingConsentState.LOCAL_REQUESTED_REMOTE_GRANTED;
        } else if (this.userConsent_.ignoringRemoteUserOffer) {
          this.gettingConsentState =
              GettingConsentState.REMOTE_OFFERED_LOCAL_IGNORED;
        } else {
          this.gettingConsentState =
              GettingConsentState.REMOTE_OFFERED_LOCAL_NO_ACTION;
        }
      } else {
        if (this.userConsent_.localRequestsAccessFromRemote) {
          this.gettingConsentState =
              GettingConsentState.LOCAL_REQUESTED_REMOTE_NO_ACTION;
        } else {
          this.gettingConsentState = GettingConsentState.NO_OFFER_OR_REQUEST;
        }
      }

      // Update sharingConsentState, used to display correct sharing buttons.
      if (this.userConsent_.remoteRequestsAccessFromLocal) {
        if (this.userConsent_.localGrantsAccessToRemote) {
          this.sharingConsentState =
              SharingConsentState.LOCAL_OFFERED_REMOTE_ACCEPTED;
        } else if (this.userConsent_.ignoringRemoteUserRequest) {
          this.sharingConsentState =
              SharingConsentState.REMOTE_REQUESTED_LOCAL_IGNORED;
        } else {
          this.sharingConsentState =
              SharingConsentState.REMOTE_REQUESTED_LOCAL_NO_ACTION;
        }
      } else {
        if (this.userConsent_.localGrantsAccessToRemote) {
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
    public getCategories = () : UI.UserCategories => {
      var isTrustedForSharing = false;
      var isTrustedForGetting = false;
      var isPendingForSharing = false;
      var isPendingForGetting = false;

      // Share tab.
      if (this.userConsent_.remoteRequestsAccessFromLocal &&
          !this.userConsent_.ignoringRemoteUserRequest &&
          !this.userConsent_.localGrantsAccessToRemote) {
        isPendingForSharing = true;
      }
      if (this.userConsent_.localGrantsAccessToRemote) {
        isTrustedForSharing = true;
      }
      // Get tab.
      if (this.offeringInstances.length > 0 &&
          !this.userConsent_.ignoringRemoteUserOffer &&
          !this.userConsent_.localRequestsAccessFromRemote) {
        isPendingForGetting = true;
      }
      if (this.userConsent_.localRequestsAccessFromRemote) {
        isTrustedForGetting = true;
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
          instance.description = 'Computer ' + (i + 1);
        }
      }
    }

  }  // class UI.User

} // module UI
