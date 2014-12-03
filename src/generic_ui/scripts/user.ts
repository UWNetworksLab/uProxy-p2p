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
    public url             :string;
    public imageData       :string;
    public isOnline        :boolean;
    // 'filter'-related flags which indicate whether the user should be
    // currently visible in the UI.
    public instances       :UI.Instance[];

    /**
     * Initialize the user to an 'empty' default.
     */
    constructor(public userId:string, public network :UI.Network) {
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
    public getCategory = () : UI.UserCategories => {
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
          categories.shareTab = onlineOrOffline + 'RequestingAccessFromYou';
        } else if (this.instances[i].consent.localGrantsAccessToRemote) {
          categories.shareTab = onlineOrOffline + 'TrustedUproxy';
        }

        // Get tab.
        if (this.instances[i].consent.remoteGrantsAccessToLocal &&
            !this.instances[i].consent.ignoringRemoteUserOffer &&
            !this.instances[i].consent.localRequestsAccessFromRemote) {
          // && forTab == get
          categories.getTab = onlineOrOffline + 'OfferingYouAccess';
        } else if (this.instances[i].consent.localRequestsAccessFromRemote) {
          categories.getTab = onlineOrOffline + 'TrustedUproxy';
        }
      }

      return categories;
    }

  }  // class UI.User

} // module UI
