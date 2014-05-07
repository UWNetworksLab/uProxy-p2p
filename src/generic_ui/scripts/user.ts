/**
 * user.ts
 *
 * This is the UI-specific representation of a User.
 */
/// <reference path='../../../node_modules/freedom-typescript-api/interfaces/social.d.ts' />
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
    public online          :boolean = false;
    public canUProxy       :boolean = false;
    public givesMe         :boolean = false;
    public usesMe          :boolean = false;
    public hasNotification :boolean = false;
    public clients;
    public instances       :UI.Instance[];

    /**
     * Initialize the user to an 'empty' default.
     */
    constructor(public userId:string) {
      console.log('new user: ' + this.userId);
      this.name = '';
      this.clients = {};
      this.instances = [];
    }

    /**
     * Update user details.
     */
    public update = (profile:freedom.Social.UserProfile) => {
      if (this.userId !== profile.userId) {
        console.error('Unexpected userId: ' + profile.userId);
      }
      this.name = profile.name;
      this.url = profile.url;
      this.imageData = profile.imageDataUri;
    }

    /**
     * Update clients and instances.
     */
    public refreshStatus = (statuses:UProxyClient.Status[]) => {
      // Is online if there is at least one client that is not 'OFFLINE'.
      this.online = statuses.some((status) => {
        return UProxyClient.Status.OFFLINE !== status;
      });
      // Has uProxy if there is at least one client that is 'ONLINE'.
      this.canUProxy = statuses.some((status) => {
        return UProxyClient.Status.ONLINE === status;
      });
      console.log('Updated ' + this.name + ' - known to be: ' +
                  '\n online: ' + this.online +
                  '\n uproxy-enabled: ' + this.canUProxy);
    }

    /**
     * Set the instances on this user.
     * TODO: Type instances.
     */
    public setInstances = (instances:UI.Instance[]) => {
      this.instances = instances;
    }

  }  // class UI.User

} // module UI
