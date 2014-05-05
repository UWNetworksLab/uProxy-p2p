/**
 * ui.d.ts
 *
 * Interfaces specific to the UI.
 * (There are equivalents for these data structures on the Core side, but those
 * contain attributes / functionality not relevant to the UI.)
 */
/// <reference path='user.d.ts' />
/// <reference path='../../node_modules/freedom-typescript-api/interfaces/social.d.ts' />

declare module UI {

  /**
   * Structure of the uProxy UI model object:
   */
  export interface Model {
    networks :{ [name:string] :UI.Network };
    // TODO: Other top-level generic info...

    // This is a 'global' roster - a combination of all User Profiles.
    // TODO: remove. The way the UI works will soon change drastically.
    roster :{ [userId:string] :User }
  }

  /**
   * Specific to one particular Social network.
   */
  export interface Network {
    name   :string;
    online :boolean;
    roster :{ [userId:string] :User }
  }

  // export interface User extends BaseUser {
  // }

  // Payloads for crossing the Core -> User boundary.
  export interface NetworkMessage {
    name    :string;
    online  :boolean;
  }

  export interface UserMessage {
    network :string;
    user    :freedom.Social.UserProfile;
  }

  // TODO: clients and instance UI types.


  /**
   * UI-specific User.
   * TODO: Maybe convert into an actual class.
   */
  export interface User extends BaseUser {
    // 'filter'-related flags which indicate whether the user should be
    // currently visible in the UI.
    online          :boolean;
    canUProxy       :boolean;
    givesMe         :boolean;
    usesMe          :boolean;
    hasNotification :boolean;
  }

}  // module UI
