/**
 * uproxy.d.ts
 *
 * Basic uproxy interface.
 */

module Interfaces {
  interface IUproxy {
    // Clears all state and storage.
    reset() : void;

    // Send your own instanceId to target clientId.
    sendInstance(clientId : string) : void;
    modifyConsent();

    // Consent
    requestAccess(instanceId : string) : void;
    cancelRequest(instanceId : string) : void;
    acceptOffer(instanceId : string) : void;
    declineOffer(instanceId : string) : void;
    offer(instanceId : string) : void;
    allow(instanceId : string) : void;
    deny(instanceId : string) : void;
    revoke(instanceId : string) : void;

    // Using peer as a proxy.
    start(instanceId : string) : void;
    stop(instanceId : string) : void;

    updateDescription(description : string) : void;
    changeOption(option
  }

  interface IUproxyOptions {
    allowNonroutableAddresses(enabled : bool) : void;
    setStunServers(servers : string[]) : void;
    setTurnServers(servers : string[]) : void;
  }
}
