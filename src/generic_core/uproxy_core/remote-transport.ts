
// Serializable network information.
module Transport {
  export enum Type { SOCKS5, WEBRTC_SOCKS5, TOR, PSIPHON }

  export interface Json {
    type :string;
  }
}

interface Transport {
  socksToWebrtc ?:{
   publicKey :string;
  }

  getJson() :string;
}
