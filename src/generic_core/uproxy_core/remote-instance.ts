///
// remote-instance.ts
//
module Remote {

  export enum TransportType { SOCKS5, WEBRTC_SOCKS5, TOR, PSIPHON }
  export enum ObfuscationType { NONE, RANDOM1 }
  export enum SocialNetworkType { GTALK, FB, XMPP }
  export enum SocialNetworkStatus { ONLINE, OFFLINE }


  // Serializable network information.
  export interface SocialConnectionData {
    type : NetworkType;
    id : string;
  }

  // Serializable network information.
  export interface SocialConnection {
    getJson() : string;
  }

  // Serializable network information.
  export interface Transport {
    access() : void;
    () : void;

    socksToWebrtc ?: {
      publicKey : string;
    }

    getJson() : string;
  }

  //
  export interface InstanceData {
    remoteProxyState : Consent.ProxyState;
    remoteClientState : Consent.ClientState;

    // instanceId, unique.
    instanceId : string;
    socialConnection : SocialConnection;
  }

  //
  class Instance implements InstanceData {
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


}  // module RemoteInstance

