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


interface InstanceTrust {
  asProxy  :string;
  asClient :string;
}


interface RosterInfo {
  userId  :string;
  name    :string;
  network :string;
  url     :string;
}


interface Instance {
  instanceId  :string;
  keyHash     :string;
  trust       :InstanceTrust;  // TODO: replace with new consent piece.
  status      :string;
  description :string;
  notify      :boolean;   // TODO: replace with better notications
  rosterInfo  ?:RosterInfo;
}
