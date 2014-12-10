/**
 * user.ts
 *
 * This is the UI-specific representation of a User.
 */
/// <reference path='../../freedom/typings/social.d.ts' />
/// <reference path='../../generic_core/consent.ts' />
/// <reference path='../../interfaces/user.d.ts' />

module UI {

  /**
   * UI-specific user.
   */
  export class User implements BaseUser {

    public name            :string;
    public imageData       :string;
    public isOnline        :boolean;
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
      this.isOnline = profile.isOnline;
    }

    // Returns two strings, where each matches an array name in model.contacts.
    // Does not use an enum because we need a string value, and typescript
    // enums evaluate to numbers.
    public getCategories = () : UI.UserCategories => {
      var onlineOrOffline = this.isOnline ? 'online' : 'offline';
      if (this.instances.length == 0) {
        return {getTab: onlineOrOffline + 'NonUproxy',
                shareTab: onlineOrOffline + 'NonUproxy'};
      }

      var categories = {getTab: onlineOrOffline + 'UntrustedUproxy',
                        shareTab: onlineOrOffline + 'UntrustedUproxy'};

      // Check if any instances have non-none consent state.
      for (var i = 0; i < this.instances.length; ++i) {
        // TODO: check these values / change after consent rewrite.

        // Share tab.
        if (this.instances[i].consent.remoteRequestsAccessFromLocal &&
            !this.instances[i].consent.ignoringRemoteUserRequest &&
            !this.instances[i].consent.localGrantsAccessToRemote) {
          categories.shareTab = onlineOrOffline + 'Pending';
        } else if (this.instances[i].consent.localGrantsAccessToRemote) {
          categories.shareTab = onlineOrOffline + 'TrustedUproxy';
        }

        // Get tab.
        if (this.instances[i].consent.remoteGrantsAccessToLocal &&
            !this.instances[i].consent.ignoringRemoteUserOffer &&
            !this.instances[i].consent.localRequestsAccessFromRemote) {
          categories.getTab = onlineOrOffline + 'Pending';
        } else if (this.instances[i].consent.localRequestsAccessFromRemote) {
          categories.getTab = onlineOrOffline + 'TrustedUproxy';
        }
      }

      return categories;
    }

    private getOrdinal = (n :number) => {
      // TODO: translate this.
      var specialCases = {1: '1st', 2: '2nd', 3: '3rd'};
      return specialCases[n] || (n + 'th');
    }

    public updateInstanceDescriptions = () => {
      if (this.instances.length <= 1) {
        // Leave descriptions unchanged if there are 0 or 1 instances.
        return;
      }
      for (var i = 0; i < this.instances.length; ++i) {
        var instance = this.instances[i];
        if (!instance.description) {
          // Set description to "1st Computer", "2nd Computer", etc.
          instance.description = this.getOrdinal(i + 1) + ' Computer';
        }
      }
    }

  }  // class UI.User

} // module UI
