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

interface ConsentState {
  asClient :Consent.ClientState;
  asProxy  :Consent.ProxyState;
}

interface ConsentMessage {
  instanceId :string;
  consent    :Consent.State;
}

// Describing whether or not a remote instance is currently accessing or not,
// assuming consent is GRANTED for that particular pathway.
interface AccessState {
  asClient :boolean;
  asProxy  :boolean;
}


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
