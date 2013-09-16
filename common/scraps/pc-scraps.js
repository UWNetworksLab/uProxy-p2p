
  this.peerConnection.addEventListener(
      'signalingstatechange', function(e) {
    console.log("PC: new signalling state: " + this.peerConnection.signalingState);
    if(this.peerConnection.signalingState === RTCSignalingState.stable) {
      console.log("Peer connection opened.");
      this.emit('open');
    }
  }.bind(this), true);
