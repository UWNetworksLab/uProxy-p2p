/// <reference path='../../peerconnection.d.ts' />
/// <reference path='../../datachannel.d.ts' />
/// <reference path='../../../logging/logging.d.ts' />

var sendButtonA = document.getElementById("sendButtonA");
var sendButtonB = document.getElementById("sendButtonB");

var sendAreaA = <HTMLInputElement>document.getElementById("sendAreaA");
var sendAreaB = <HTMLInputElement>document.getElementById("sendAreaB");
var receiveAreaA = <HTMLInputElement>document.getElementById("receiveAreaA");
var receiveAreaB = <HTMLInputElement>document.getElementById("receiveAreaB");

var log :Logging.Log = new Logging.Log('main.ts');

// Create a peer connection with logging for all its actions.
function setupLoggingPeerConnection(name:string, receiveArea:HTMLInputElement) : WebRtc.PeerConnection {
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
    peerName: name
  };
  var pc = new WebRtc.PeerConnection(pcConfig);
  pc.onceConnected.then((endpoints:WebRtc.ConnectionAddresses) => {
    log.info(name + ': connected: ' +
        endpoints.local.address + ':' + endpoints.local.port +
        ' (' + WebRtc.CandidateType[endpoints.localType] + ') <-> ' +
        endpoints.remote.address + ':' + endpoints.remote.port +
        ' (' + WebRtc.CandidateType[endpoints.remoteType] + ')\n' +
        pc.toString());
  });
  pc.onceConnecting.then(() => {
    log.info(name + ': onceConnecting: ' + pc.toString());
  });
  pc.onceDisconnected.then(() => {
    log.info(name + ': onceDisconnected: ' + pc.toString());
  });
  pc.peerOpenedChannelQueue.setSyncHandler((d:WebRtc.DataChannel) => {
    log.info(name + ': peerOpenedChannelQueue: ' +
          d.toString());
    d.onceOpened.then(() => {
      log.info(name + ': onceOpened: ' +
          d.toString());
    });
    d.onceClosed.then(() => {
      log.info(name + ': onceClosed: ' +
          d.toString());
    });
    d.dataFromPeerQueue.setSyncHandler((data:WebRtc.Data) => {
      log.info(name + ': dataFromPeer: ' + JSON.stringify(data));
      // Handle messages received on the datachannel(s).
      // The message is forwarded to the UI.
      // TODO: only the first message sent over the data channel is received
      if(receiveArea) {
        receiveArea.value = JSON.stringify(data);
      }
    });
  });
  return pc;
}

//------------------------------------------------------------------------------
var a :WebRtc.PeerConnection = setupLoggingPeerConnection('a', receiveAreaA);
var b :WebRtc.PeerConnection = setupLoggingPeerConnection('b', receiveAreaB);

// Connect the two signalling channels. Normally, these messages would be sent
// over the internet.
a.signalForPeerQueue.setSyncHandler((signal:WebRtc.SignallingMessage) => {
    b.handleSignalMessage(signal);
  });
b.signalForPeerQueue.setSyncHandler((signal:WebRtc.SignallingMessage) => {
  a.handleSignalMessage(signal);
});

// Have a negotiate a peerconnection. Once negotiated, enable the UI and add
// send/receive handlers.
a.negotiateConnection().then(() => {
  log.info('peerconnection negotiated!');
  sendAreaA.disabled = false;
  sendAreaB.disabled = false;

  // Send messages over the datachannel, in response to events
  // arriving from the UI.
  function send(pc:WebRtc.PeerConnection, textArea:HTMLInputElement) {
    pc.dataChannels['text'].send({
      str: textArea.value || '(empty message)'
    }).catch((e) => {
      log.error('could not send: ' + e.message); }
    );
  }
  sendButtonA.onclick = send.bind(null, a, sendAreaA);
  sendButtonB.onclick = send.bind(null, b, sendAreaB);

  var chanA = a.openDataChannel('text');
}, (e) => {
  log.error('could not negotiate peerconnection: ' + e.message);
});
