/// <reference path='../freedom/typings/rtcpeerconnection.d.ts' />

import WebRtcTypes = require('./webrtc.types');
import PeerConnectionClass = require('./peerconnection');

export function createPeerConnection(
    config:freedom_RTCPeerConnection.RTCConfiguration, debugPcName?:string)
    : WebRtcTypes.PeerConnection<WebRtcTypes.SignallingMessage> {
  var freedomRtcPc = freedom['core.rtcpeerconnection'](config);
  // Note: |peerConnection| will take responsibility for freeing memory and
  // closing down of freedomRtcPc once the underlying peer connection is closed.
  var peerConnection = new PeerConnectionClass(freedomRtcPc, name);
  return peerConnection;
}
