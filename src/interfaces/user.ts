/**
 * The 'User' type is used both in uProxy's core and UI, so there will be a base
 * interface to be extended as classes specific to particular components.
 */

export interface UserPath {
  network :SocialNetworkInfo;
  userId :string;
}

export interface SocialNetworkInfo {
  name :string;
  userId :string;
}

export interface InstancePath extends UserPath {
  instanceId :string;
}

//
export interface BaseUser {
  userId :string;
  name :string;
}


/**
 * Base interface for all Instances.
 */
export interface Instance {
  instanceId  :string;
  keyHash     :string;
  status      ?:string; // Status on social network e.g. online or offline.
  notify      ?:boolean;   // TODO: replace with better notications
}
