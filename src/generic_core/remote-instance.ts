/**
 * remote-instance.ts
 *
 * This file defines the uProxy Instance class for remote installations.
 *
 * Instance information must be passed across the signalling channel so that
 * any pair of uProxy installations can speak to one another
 * about their current status and consent level.
 */
/// <reference path='../interfaces/instance.d.ts' />
/// <reference path='consent.ts' />

/*
// Taken from consent.d.ts. Need to move into its own file, but not a .d.ts file
// because there are Enums.
module Consent {
  // Action taken by the remote instance. These values are on the wire, so we
  // need to distinguish the values for the remote as client vs proxy. i.e. we
  // cannot have two enums.
  export enum RemoteState {
    NONE, REQUESTING, OFFERING, BOTH
  }
  // Action taken by the user. These values are on the wire, so we need to
  // distinguish the values for the remote as client vs proxy. i.e. we cannot
  // have two enums.
  export enum UserAction {
    // Actions made by user w.r.t. remote as a proxy, or
    REQUEST, CANCEL_REQUEST, ACCEPT_OFFER, IGNORE_OFFER,
    // Actions made by user w.r.t. remote as a client, or
    OFFER, CANCEL_OFFER, ALLOW_REQUEST, IGNORE_REQUEST
  }
  // User-level consent state for a remote instance to be proxy client for the
  // user.
  export enum ClientState {
    NONE, USER_OFFERED, REMOTE_REQUESTED, USER_IGNORED_REQUEST, GRANTED
  }
  // User-level consent state for a remote instance to be a proxy server for the
  // user.
  export enum ProxyState {
    NONE, USER_REQUESTED, REMOTE_OFFERED, USER_IGNORED_OFFER, GRANTED
  }
}
*/
/// <reference path='social.ts' />


module Core {

  export class RemoteInstance implements Instance {

    public instanceId    :string;
    public keyHash       :string
    //socialConnection : SocialConnection;
    public trust         :InstanceTrust;
    public description   :string;

    private transport             :Transport;
    private proxyConsent  :Consent.ProxyState;
    private clientConsent :Consent.ClientState;

    /**
     * Construct a Remote Instance as the result of receiving an instance
     * handshake.
     */
    constructor(
        public network :Social.Network,
        handshake : Instance) {
      function clone(x) { return JSON.parse(JSON.stringify(x)); }
      // this.remoteProxyState = clone(data.remoteProxyState);
      // this.remoteClientState = clone(data.remoteClientState);
      this.instanceId = handshake.instanceId;
      // TODO: copy the rest of the data.
    }

    //
    // getJSON() {
      // return {
        // remoteProxyState: this.remoteProxyState,
        // remoteClientState: this.remoteClientState,
        // instanceId: this.instanceId,
        // transport: this.transport.getJson(),
        //socialConnection: this.socialConnection_.getJson()
      // }
    // }
  }  // class remote instance.

  export enum ObfuscationType {NONE, RANDOM1 }

  // Json format for a remote instance.
  export interface InstanceJson {
    // instanceId, unique.
    instanceId : string;
    //
    remoteProxyState : Consent.ProxyState;
    remoteClientState : Consent.ClientState;

    // Json for the social connection.
    //socialConnection : SocialConnection.Json;
    // Json for the transport provided by the instance.
    transport : Transport.Json;
  }

}  // module Core
