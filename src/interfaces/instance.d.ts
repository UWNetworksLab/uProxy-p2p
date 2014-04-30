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


interface RosterInfo {
  userId  :string;
  name    :string;
  network :string;
  url     :string;
}


interface Instance {
  instanceId  :string;
  description :string;
  keyHash     :string;
  status      ?:string;
  notify      ?:boolean;   // TODO: replace with better notications
  rosterInfo  ?:RosterInfo;
}


/**
 * Instance Handshakes are sent between uProxy installations to notify each
 * other about existence.
 */
interface InstanceHandshake {
  instanceId  :string;
  keyHash     :string;
  description ?:string;  // TODO: Determine if description is actually optional.
}
