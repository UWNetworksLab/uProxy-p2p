/**
 * auth.ts
 *
 * This file contains functions related to uProxy authentication.
 * TODO: Hook the video-auth SAS-RTC component into here.
 */
/// <reference path='../freedom/typings/rtcpeerconnection.d.ts' />

module Auth {

  export var localKey :string = null;  // Key extracted from peerconnection.
  export var ttl      :number = 0;  // Expiry of the key.

  var fCore_ = freedom.core();
  var pc_ = freedom['core.rtcpeerconnection']();

  // This regular expression captures the fingerprint from an sdp header.
  // TODO: Allow hashes other than sha-256.
  var SDP_FINGERPRINT_REGEX =
      /^(?:a=fingerprint:sha-256\s)((?:[0-9a-f]{2}:){31}[0-9a-f]{2})\s*$/mi;

  /**
   * Create an un-used local WebRTC peer connection to obtain the local keyhash
   * from. Returns a promise fulfilled with the keyhash string.
   */
  export function getLocalFingerprint() : Promise<string> {
    if (null !== localKey) {
      return Promise.resolve(localKey);
    }
    // TODO: This file will only work after commit
    // 72f55be51c1dc5f339a959963be90aec87fa0ab9 in freedom.
    if (undefined === pc_['createOffer']) {
      return Promise.reject(new Error(
          'freedom core.peerconnection missing createOffer!'));
    }

    return pc_.createOffer()
        .then(extractFingerprint)
        .catch((e) => {
          console.error('Could not fetch local fingerprint.');
          return Promise.reject(e);
        });
  }

  /**
   * Use a regex to extract just the fingerprint string from an sdp header.
   */
  export function extractFingerprint(desc:freedom_RTCPeerConnection.RTCSessionDescription) : string {
    var sdp = desc.sdp;
    var captured = sdp.match(SDP_FINGERPRINT_REGEX);
    if (!captured || !captured[1]) {
      console.warn('SDP header does not contain fingerprint.');
      return null;
    }
    return captured[1];
  }

}  // module Auth
