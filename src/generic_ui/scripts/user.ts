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

    // Returns a string which matches the array names in model.contacts.
    // Does not use an enum because we need a string value, and typescript
    // enums evaluate to numbers.
    public getCategory = () : string => {
      var onlineOrOffline = this.isOnline ? 'online' : 'offline';
      if (this.instances.length == 0) {
        return onlineOrOffline + 'NonUproxy';
      }
      // Check if any instances have non-none consent state.
      for (var i = 0; i < this.instances.length; ++i) {
        // TODO: check these values / change after consent rewrite.
        if (this.instances[i].consent.localGrantsAccessToRemote ||
            this.instances[i].consent.remoteGrantsAccessToLocal) {
          return onlineOrOffline + 'TrustedUproxy';
        }
      }
      return onlineOrOffline + 'UntrustedUproxy';
    }

  }  // class UI.User

} // module UI
