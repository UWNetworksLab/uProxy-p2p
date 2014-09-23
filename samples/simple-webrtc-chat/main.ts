/// <reference path='../../logging/logging.d.ts' />
/// <reference path='../../webrtc/peerconnection.d.ts' />
/// <reference path='../../webrtc/datachannel.d.ts' />

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
        ' (' + endpoints.localType + ') <-> ' +
        endpoints.remote.address + ':' + endpoints.remote.port +
        ' (' + endpoints.remoteType + ')\n' +
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
      // Handle messages received on the datachannel(s). The message is
      // forwarded to the UI. TODO: only the first message sent over the data
      // channel is received. The if-statement allows us to create new peer-
      // connections in the console that are not tied to the UI.
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

// Send messages over the datachannel, in response to events
// arriving from the UI.
function send(pc:WebRtc.PeerConnection, textArea:HTMLInputElement) {
  log.info('sending: ' + JSON.stringify(textArea.value));
  pc.dataChannels['text'].send({
    str: textArea.value
  }).catch((e) => {
    log.error('could not send: ' + e.message); }
  );
}

sendButtonA.onclick = send.bind(null, a, sendAreaA);
sendButtonB.onclick = send.bind(null, b, sendAreaB);

// Have a negotiate a peerconnection. Once negotiated, open data channel. Once
// that works, enable the UI.
a.negotiateConnection()
  .then(() => {
    var aTextDataChannel = a.openDataChannel('text');
    aTextDataChannel.dataFromPeerQueue.setSyncHandler((data:WebRtc.Data) => {
      log.info('a: dataFromPeer: ' + JSON.stringify(data));
      receiveAreaA.value = JSON.stringify(data);
    });
  })
  .then(() => {
    log.info('peerconnection negotiated!');
    sendAreaA.disabled = false;
    sendAreaB.disabled = false;
    sendButtonA.disabled = false;
    sendButtonB.disabled = false;
}, (e) => {
  log.error('could not negotiate peerconnection: ' + e.message);
});
