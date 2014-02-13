///
// remote-instance.ts
//
module RemoteInstance {

  enum ProxyType { SOCKS5, WEBRTC_SOCKS5, TOR, PSIPHON }
  enum ObfuscationType { NONE, RANDOM }
  enum NetworkType { GTALK, FB, XMPP }
  enum NetworkStatus { ONLINE, OFFLINE }

  // Serializable network information.
  interface SocialId {
    type : NetworkType;
    id : string;
  }

  //
  interface RemoteInstanceJson {
    remoteAsProxyConsent : Consent.Status;
    remoteAsClientConsent : Consent.Status;

    // instanceId, unique.
    instanceId : string;
    publicKey : string;
    networkJson : NetworkJson;
  }

  //
  class RemoteInstance {
    remoteAsProxyConsent : Consent.ProxyState;
    remoteAsClientConsent : Consent.ClientState;

    // instanceId, unique.
    instanceId : string;

    //
    socialId : SocialId
    onlineStatus : NetworkStatus;

    //
    constructor(json : RemoteInstanceJson) {
      this.proxyConsent = json
      this.accessConsent = {remoteConsent: false, localConsent: false};
    }

    //
    getJSON() {
      return {
        offeredConsent: this.proxyConsent,
        requestedConsent: this.accessConsent,
        instanceId: this.instanceId,
        publicKey: this.publicKey,
        socialId: this.socialId
      }
    }
  }  // class remote instance.

}  // module RemoteInstance
