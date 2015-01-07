import PeerConnectionInterfaces = require('peerconnection.i');
import PeerConnectionClass = require('peerconnection');

export function createPeerConnection(
      config:PeerConnectionInterfaces.PeerConnectionConfig)
    : PeerConnectionInterfaces.PeerConnection<
        PeerConnectionInterfaces.SignallingMessage> {
  return new PeerConnectionClass(config);
}
