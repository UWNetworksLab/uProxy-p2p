// remote-instance.ts
//
module RemoteInstance {

  enum ProxyType { SOCKS5, WEBRTC_SOCKS5, TOR, PSIPHON }
  enum ObfuscationType { NONE, RANDOM }
  enum NetworkType { GTALK, FB, XMPP }
  enum NetworkStatus { ONLINE, OFFLINE }




    // A consent action has been taken by the user w.r.t. this remote instance.
    localConsentAction(action : Consent.Action) {
      switch(action){
        case Consent.Action.REQUEST: localRequest_(); break;
        case Consent.Action.CANCEL_REQUEST:

          break;
        case Consent.Action.ACCEPT_OFFER:
          switch(remoteAsProxyConsent){
            case Consent.Status.OFFERED:
              remoteAsProxyConsent = Consent.Status.GRANTED;
              break
            case Consent.Status.NONE:
            case Consent.Status.REQUESTED:
            case Consent.Status.GRANTED:
              console.warn("Local accepted offer, outside offer state.");
              break;
          }
          break;

        case Consent.Action.OFFER:
        case Consent.Action.ALLOW_REQUEST:
          proxyConsent.remoteConsent = true; break;

        case Consent.Action.CANCEL_OFFER:
        case Consent.Action.DENY_REQUEST:
          proxyConsent.remoteConsent = false; break;
      }
    }

    handleRemoteConsentAction(action : Consent.Action) {
      switch(action){
        case Consent.Action.REQUEST:
        case Consent.Action.ACCEPT_OFFER:
          accessConsent.localConsent = true; break;

        case Consent.Action.DECLINE_OFFER:
        case Consent.Action.CANCEL_REQUEST:
          accessConsent.localConsent = false; break;

        case Consent.Action.OFFER:
        case Consent.Action.ALLOW_REQUEST:
          proxyConsent.remoteConsent = true; break;

        case Consent.Action.CANCEL_OFFER:
        case Consent.Action.DENY_REQUEST:
          proxyConsent.remoteConsent = false; break;
      }
    }



  }

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
    remoteAsProxyConsent : Consent.Status;
    remoteAsClientConsent : Consent.Status;

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

}  // RemoteInstance
