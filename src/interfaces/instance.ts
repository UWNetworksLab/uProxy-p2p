/**
 * Definitions for Instances. Instances define information about a single uProxy
 * installation on a single device. The |instanceId| is the unique identifier
 * for an instance.
 *
 * Instance information must be passed across the signalling channel so that
 * any pair of uProxy installations can speak to one another
 * about their current status and consent level.
 */

import uproxy_types = require('../uproxy');

// TODO: Maybe wrap these in a module for everyting to do with Instances that
// needs to be accessible both in core and UI.

export interface NetworkInfo {
  name :string;
  userId :string;
}

/**
 * LocalPeerId can contain the full instance paths so that we can easily
 * look up instance objects.
 */
export interface LocalPeerId {
  clientInstancePath :uproxy_types.InstancePath;
  serverInstancePath :uproxy_types.InstancePath;
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

/**
 * Instance Handshakes are sent between uProxy installations to notify each
 * other about existence.
 */
export interface InstanceHandshake {
  instanceId  :string;
  keyHash     :string;
  consent     :uproxy_types.ConsentWireState;
  description ?:string;
}
