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
      // this.remoteProxyState = clone(data.remoteProxyState);
      // this.remoteClientState = clone(data.remoteClientState);
      this.update(handshake);
    }

    /**
     * Send a message to this instance.
     */
    public send = (msg:string) => {
    }

    /**
     * Update the information about this remote instance as a result of its
     * Instance Message.
     * Assumes that |data| actually belongs to this instance.
     */
    public update = (data :Instance) => {
      // TODO: copy the rest of the data.
      this.instanceId = data.instanceId;
    }

    /**
     * Send local consent bits to this remote instance.
     */
    public sendConsent = () => {
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
