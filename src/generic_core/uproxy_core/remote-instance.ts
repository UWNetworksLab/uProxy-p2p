/**
 * remote-instance.ts
 **/

//
class RemoteInstance {
  remoteProxyState : Consent.ProxyState;
  remoteClientState : Consent.ClientState;

  // instanceId, unique.
  instanceId : string;

  //
  transport : Transport;
  socialConnection : SocialConnection;

  //
  constructor(data : InstanceData) {
    function clone(x) { return JSON.parse(JSON.stringify(x)); }
    this.remoteProxyState = clone(data.remoteProxyState);
    this.remoteClientState = clone(data.remoteClientState);
    this.instanceId = clone(data.instanceId);
    this.publicKey = clone(data.publicKey);
    this.socialId = clone(data.socialId);
  }

  //
  getJSON() {
    return {
      remoteProxyState: this.remoteProxyState,
      remoteClientState: this.remoteClientState,
      instanceId: this.instanceId,
      transport: this.transport_.getJson();
      socialConnection: this.socialConnection_.getJson();
    }
  }
}  // class remote instance.


module RemoteInstance {
  // Json format for a remote instance.
  export interface Json {
    // instanceId, unique.
    instanceId : string;
    //
    remoteProxyState : Consent.ProxyState;
    remoteClientState : Consent.ClientState;

    // Json for the social connection.
    socialConnection : SocialConnection.Json;
    // Json for the transport provided by the instance.
    trabsport : Transport.Json;
  }


  export enum ObfuscationType { NONE, RANDOM1 }

}  // module RemoteInstance

