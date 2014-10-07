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
    public url             :string;
    public imageData       :string;
    // 'filter'-related flags which indicate whether the user should be
    // currently visible in the UI.
    public instances       :UI.Instance[];

    /**
     * Initialize the user to an 'empty' default.
     */
    constructor(public userId:string) {
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

  }  // class UI.User

} // module UI
