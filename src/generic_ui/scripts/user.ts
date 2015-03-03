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

    public name            :string;
    public imageData       :string;
    public isGettingFromMe :boolean = false;
    public isSharingWithMe :boolean = false;
    // 'filter'-related flags which indicate whether the user should be
    // currently visible in the UI.
    public instances       :UI.Instance[];

    /**
     * Initialize the user to an 'empty' default.
     */
    constructor(public userId :string, public network :UI.Network) {
      console.log('new user: ' + this.userId);
      this.name = '';
      this.instances = [];
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
      var isOnline = false;
      var isTrustedForSharing = false;
      var isTrustedForGetting = false;
      var isPendingForSharing = false;
      var isPendingForGetting = false;
      for (var i = 0; i < this.instances.length; ++i) {
        var instance = this.instances[i];
        if (instance.isOnline) {
          isOnline = true;
        }
        // Share tab.
        if (instance.consent.remoteRequestsAccessFromLocal &&
            !instance.consent.ignoringRemoteUserRequest &&
            !instance.consent.localGrantsAccessToRemote) {
          isPendingForSharing = true;
        }
        if (instance.consent.localGrantsAccessToRemote) {
          isTrustedForSharing = true;
        }
        // Get tab.
        if (instance.consent.remoteGrantsAccessToLocal &&
            !instance.consent.ignoringRemoteUserOffer &&
            !instance.consent.localRequestsAccessFromRemote) {
          isPendingForGetting = true;
        }
        if (instance.consent.localRequestsAccessFromRemote) {
          isTrustedForGetting = true;
        }
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
      if (this.instances.length <= 1) {
        // Leave descriptions unchanged if there are 0 or 1 instances.
        return;
      }
      for (var i = 0; i < this.instances.length; ++i) {
        var instance = this.instances[i];
        if (!instance.description) {
          // Set description to "Computer 1", "Computer 2", etc.
          instance.description = 'Computer ' + (i + 1);
        }
      }
    }

  }  // class UI.User

} // module UI
