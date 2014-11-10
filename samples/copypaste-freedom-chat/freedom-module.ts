/// <reference path="../../webrtc/peerconnection.d.ts" />
/// <reference path="../../logging/logging.d.ts" />

var log :Logging.Log = new Logging.Log('copypaste-socks');

var pcConfig :WebRtc.PeerConnectionConfig = {
  webrtcPcConfig: {
    iceServers: [{urls: ['stun:stun.l.google.com:19302']},
                 {urls: ['stun:stun1.l.google.com:19302']}]
  },
  peerName: 'pc'
};

function connectDataChannel(d:WebRtc.DataChannel) {
  d.dataFromPeerQueue.setSyncHandler((data:WebRtc.Data) => {
    freedom().emit('messageFromPeer', data.str);
  });

  freedom().on('messageFromPeer', (message:string) => {
    d.send({ str: message }).catch((e) => {
      log.error('error sending chat message: ' + e.message);
    });
  });
}

function makePeerConnection() : WebRtc.PeerConnection {
  var pc :WebRtc.PeerConnection = new WebRtc.PeerConnection(pcConfig);

  pc.signalForPeerQueue.setSyncHandler((signal:WebRtc.SignallingMessage) => {
    freedom().emit('signalForPeer', signal);
  });

  pc.onceConnected.then((endpoints:WebRtc.ConnectionAddresses) => {
    log.info('connected: ' +
         endpoints.local.address + ':' + endpoints.local.port +
         ' (' + endpoints.localType + ') <-> ' +
         endpoints.remote.address + ':' + endpoints.remote.port +
         ' (' + endpoints.remoteType + ')');
  });

  pc.peerOpenedChannelQueue.setSyncHandler((d:WebRtc.DataChannel) => {
    if (d.getLabel() === 'text') {
      connectDataChannel(d);
      freedom().emit('ready');
    }
  });

  return pc;
}

var pc :WebRtc.PeerConnection;

freedom().on('start', () => {
  pc = makePeerConnection();
  pc.negotiateConnection()
    .then((endpoints:WebRtc.ConnectionAddresses) => {
      return pc.openDataChannel('text');
    })
    .then(connectDataChannel)
    .then(() => {
      freedom().emit('ready');
    })
    .catch((e:Error) => {
      log.error('could not negotiate peerconnection: ' + e.message);
    });
});

// Receive signalling channel messages from the UI.
// If pc doesn't exist yet then we are responding to the remote
// peer's initiation.
freedom().on('signalFromPeer', (signal:WebRtc.SignallingMessage) => {
  if (pc === undefined) {
    pc = makePeerConnection();
  }
  pc.handleSignalMessage(signal);
});
