/**
 * user.ts
 *
 * This is the UI-specific representation of a User.
 */
/// <reference path='../../freedom/typings/social.d.ts' />
/// <reference path='../../interfaces/user.d.ts' />

module UI {
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

    public userConsent  :uProxy.UserConsentState;

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
    public update = (profile :UI.UserProfileMessage) => {
      if (this.userId !== profile.userId) {
        console.error('Unexpected userId: ' + profile.userId);
      }
      this.name = profile.name;
      this.imageData = profile.imageData || UI.DEFAULT_USER_IMG;
    }

    // Returns two strings, where each matches an array name in model.contacts.
    // Does not use an enum because we need a string value, and typescript
    // enums evaluate to numbers.
    // CONSIDER: Avoid strings for values and string-param dependencies
    // https://github.com/uProxy/uproxy/issues/769
    public getCategories = () : UI.UserCategories => {
      // TODO: we can't just search offeringInstances for isOnline
      // it should probably be something sent from the app as part of the user
      var isOnline = false;
      for (var i = 0; i < this.offeringInstances.length; ++i) {
        if (this.offeringInstances[i].isOnline) {
          isOnline = true;
          break;
        }
      }

      var isTrustedForSharing = false;
      var isTrustedForGetting = false;
      var isPendingForSharing = false;
      var isPendingForGetting = false;

      // Share tab.
      if (this.userConsent.remoteRequestsAccessFromLocal &&
          !this.userConsent.ignoringRemoteUserRequest &&
          !this.userConsent.localGrantsAccessToRemote) {
        isPendingForSharing = true;
      }
      if (this.userConsent.localGrantsAccessToRemote) {
        isTrustedForSharing = true;
      }
      // Get tab.
      if (this.offeringInstances.length > 0 &&
          !this.userConsent.ignoringRemoteUserOffer &&
          !this.userConsent.localRequestsAccessFromRemote) {
        isPendingForGetting = true;
      }
      if (this.userConsent.localRequestsAccessFromRemote) {
        isTrustedForGetting = true;
      }

      // Convert booleans into strings.
      var isOnlineString = isOnline ? 'online' : 'offline';
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
