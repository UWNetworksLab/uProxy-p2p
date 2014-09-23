/// <reference path="../../../webrtc/peerconnection.d.ts" />
/// <reference path="../../../freedom/coreproviders/uproxypeerconnection.d.ts" />
/// <reference path="../../../freedom/coreproviders/uproxylogging.d.ts" />
/// <reference path="../../../freedom/typings/freedom.d.ts" />

var log :Freedom_UproxyLogging.Log = freedom['core.log']('copypaste-socks');

var pcConfig :WebRtc.PeerConnectionConfig = {
  webrtcPcConfig: {
    iceServers: [{url: 'stun:stun.l.google.com:19302'},
                 {url: 'stun:stun1.l.google.com:19302'},
                 {url: 'stun:stun2.l.google.com:19302'},
                 {url: 'stun:stun3.l.google.com:19302'},
                 {url: 'stun:stun4.l.google.com:19302'}]
  },
  webrtcMediaConstraints: {
    optional: [{DtlsSrtpKeyAgreement: true}]
  },
  peerName: 'pc'
};

var pc :freedom_UproxyPeerConnection.Pc;

function makePeerConnection() : freedom_UproxyPeerConnection.Pc {
  var pc :freedom_UproxyPeerConnection.Pc = freedom['core.uproxypeerconnection'](pcConfig);
  log.info('created uproxypeerconnection');

  pc.on('signalForPeer', (signal:WebRtc.SignallingMessage) => {
    freedom.emit('signalForPeer', signal);
  });

  pc.onceConnected().then((endpoints:WebRtc.ConnectionAddresses) => {
    log.info('connected: ' +
         endpoints.local.address + ':' + endpoints.local.port +
         ' (' + WebRtc.CandidateType[endpoints.localType] + ') <-> ' +
         endpoints.remote.address + ':' + endpoints.remote.port +
         ' (' + WebRtc.CandidateType[endpoints.remoteType] + ')');
  });

  pc.on('peerOpenedChannel', (channelLabel:string) => {
    if (channelLabel === 'text') {
      freedom.emit('ready');
    }
  });

  // Forward chat messages to the UI.
  pc.on('dataFromPeer', (message:freedom_UproxyPeerConnection.LabelledDataChannelMessage) => {
    freedom.emit('messageFromPeer', message.message.str);
  });

  return pc;
}

freedom.on('start', () => {
  pc = makePeerConnection();
  pc.negotiateConnection().then((endpoints:WebRtc.ConnectionAddresses) => {
    pc.openDataChannel('text');
  }).then(() => {
    freedom.emit('ready');
  });
});

// Receive signalling channel messages from the UI.
// If pc doesn't exist yet then we are responding to the remote
// peer's initiation.
freedom.on('signalFromPeer', (signal:WebRtc.SignallingMessage) => {
  if (pc === undefined) {
    pc = makePeerConnection();
  }
  pc.handleSignalMessage(signal);
});

// Receive outbound chat messages from the UI.
freedom.on('messageFromPeer', (message:string) => {
  pc.send('text', { str: message }).catch((e) => {
    log.error('error sending chat message: ' + e.message);
  });
});
