/// <reference path="../../freedom/typings/rtcpeerconnection.d.ts" />
/// <reference path="../../webrtc/peerconnection.d.ts" />
/// <reference path="../../logging/logging.d.ts" />

var log :Logging.Log = new Logging.Log('copypaste-socks');

var config :freedom_RTCPeerConnection.RTCConfiguration = {
  iceServers: [{urls: ['stun:stun.l.google.com:19302']},
               {urls: ['stun:stun1.l.google.com:19302']}]
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
  var provider :freedom_RTCPeerConnection.RTCPeerConnection =
      freedom['core.rtcpeerconnection'](config);
  var pc = WebRtc.PeerConnection.fromRtcPeerConnection(provider);

  pc.signalForPeerQueue.setSyncHandler((signal:WebRtc.SignallingMessage) => {
    freedom().emit('signalForPeer', signal);
  });

  pc.onceConnected.then(() => {
    log.info('connected');
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
    .then(() => {
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
