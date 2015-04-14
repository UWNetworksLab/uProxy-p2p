/**
 * instance.d.ts
 *
 * Definitions for Instances. Instances define information about a single uProxy
 * installation on a single device. The |instanceId| is the unique identifier
 * for an instance.
 *
 * Instance information must be passed across the signalling channel so that
 * any pair of uProxy installations can speak to one another
 * about their current status and consent level.
 */

// TODO: Maybe wrap these in a module for everyting to do with Instances that
// needs to be accessible both in core and UI.

interface NetworkInfo {
  name :string;
  userId :string;
}

/**
 * Base interface for all Instances.
 */
interface Instance {
  instanceId  :string;
  keyHash     :string;
  status      ?:string; // Status on social network e.g. online or offline.
  notify      ?:boolean;   // TODO: replace with better notications
}

/**
 * Instance Handshakes are sent between uProxy installations to notify each
 * other about existence.
 */
interface InstanceHandshake {
  instanceId  :string;
  keyHash     :string;
  consent     :uProxy.ConsentWireState;
  description ?:string;
}
