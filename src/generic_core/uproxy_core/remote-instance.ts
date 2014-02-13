///
// remote-instance.ts
//
module Remote {

  export enum ProxyType { SOCKS5, WEBRTC_SOCKS5, TOR, PSIPHON }
  export enum ObfuscationType { NONE, RANDOM }
  export enum NetworkType { GTALK, FB, XMPP }
  export enum NetworkStatus { ONLINE, OFFLINE }

  // Serializable network information.
  export interface SocialId {
    type : NetworkType;
    id : string;
  }

  //
  export interface InstanceData {
    remoteProxyState : Consent.ProxyState;
    remoteClientState : Consent.ClientState;

    // instanceId, unique.
    instanceId : string;
    publicKey : string;
    socialId : SocialId;
  }

  //
  class Instance implements InstanceData {
    remoteProxyState : Consent.ProxyState;
    remoteClientState : Consent.ClientState;

    // instanceId, unique.
    instanceId : string;
    publicKey : string;

    //
    socialId : SocialId
    onlineStatus : NetworkStatus;

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
        publicKey: this.publicKey,
        socialId: this.socialId
      }
    }
  }  // class remote instance.


}  // module RemoteInstance

