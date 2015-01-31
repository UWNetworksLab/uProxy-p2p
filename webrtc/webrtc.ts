import WebRtcTypes = require('./webrtc.types');
import PeerConnectionClass = require('./peerconnection');

export function createPeerConnection(config:WebRtcTypes.PeerConnectionConfig)
    : WebRtcTypes.PeerConnection<WebRtcTypes.SignallingMessage> {
  return new PeerConnectionClass(config);
}
