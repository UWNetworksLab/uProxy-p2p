/**
 * The 'User' type is used both in uProxy's core and UI, so there will be a base
 * interface to be extended as classes specific to particular components.
 */
/// <reference path='../../node_modules/freedom-typescript-api/interfaces/social.d.ts' />

interface BaseUser {
  userId :string;
  name :string;
  clients :{[clientId:string] :freedom.Social.Status};
  // clientToInstanceMap :{[clientId:string] :Instance};
}
