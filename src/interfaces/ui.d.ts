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
  }

  /**
   * Specific to one particular Social network.
   */
  export interface Network {
    name   :string;
    online :boolean;
    roster :{ [userId:string] :freedom.Social.UserProfile }
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

}  // module UI
