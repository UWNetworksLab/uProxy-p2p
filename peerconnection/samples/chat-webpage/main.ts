/// <reference path='../../peerconnection.d.ts' />
/// <reference path='../../datachannel.d.ts' />

var sendButtonA = document.getElementById("sendButtonA");
var sendButtonB = document.getElementById("sendButtonB");

var sendAreaA = <HTMLInputElement>document.getElementById("sendAreaA");
var sendAreaB = <HTMLInputElement>document.getElementById("sendAreaB");
var receiveAreaA = <HTMLInputElement>document.getElementById("receiveAreaA");
var receiveAreaB = <HTMLInputElement>document.getElementById("receiveAreaB");

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
  }
};
var a = new WebRtc.PeerConnection(pcConfig);
var b = new WebRtc.PeerConnection(pcConfig);

// Connect the two signalling channels.
// Normally, these messages would be sent over the internet.
a.signalForPeerQueue.setSyncHandler((signal:WebRtc.SignallingMessage) => {
  dbg('signalling channel A message: ' + JSON.stringify(signal));
  b.handleSignalMessage(signal);
});
b.signalForPeerQueue.setSyncHandler((signal:WebRtc.SignallingMessage) => {
  dbg('signalling channel B message: ' + JSON.stringify(signal));
  a.handleSignalMessage(signal);
});

// Log the chosen endpoints.
function logEndpoints(name:string, endpoints:WebRtc.ConnectionAddresses) {
  dbg(name + ' connected: ' +
      endpoints.local.address + ':' + endpoints.local.port +
      ' <-> ' +
      endpoints.remote.address + ':' + endpoints.remote.port);
}
a.onceConnected.then(logEndpoints.bind(null, 'a'));
b.onceConnected.then(logEndpoints.bind(null, 'b'));

// Have a negotiate a peerconnection.
// Once negotiated, enable the UI and add send/receive handlers.
a.negotiateConnection().then(() => {
  dbg('peerconnection negotiated!');
  sendAreaA.disabled = false;
  sendAreaB.disabled = false;

  // Send messages over the datachannel, in response to events
  // arriving from the UI.
  function send(pc:WebRtc.PeerConnection, textArea:HTMLInputElement) {
    pc.dataChannels['text'].send({
      str: textArea.value || '(empty message)'
    }).catch((e) => {
      dbgErr('could not send: ' + e.message); }
    );
  }
  sendButtonA.onclick = send.bind(null, a, sendAreaA);
  sendButtonB.onclick = send.bind(null, b, sendAreaB);

  // Handle messages received on the datachannel(s).
  // The message is forwarded to the UI.
  // TODO: only the first message sent over the data channel is received
  function receive(textArea:HTMLInputElement, d:WebRtc.Data) {
    textArea.value = d.str;
  }
  var chanA = a.openDataChannel('text');
  chanA.onceOpened.then(() => {
    chanA.dataFromPeerQueue.setSyncHandler(receive.bind(null, receiveAreaA));
  });
  b.peerCreatedChannelQueue.setSyncHandler((chanB:WebRtc.DataChannel) => {
    chanB.dataFromPeerQueue.setSyncHandler(receive.bind(null, receiveAreaB));
  });
}, (e) => {
  dbgErr('could not negotiate peerconnection: ' + e.message);
});

function dbg(msg:string) { console.log(msg); }
function dbgWarn(msg:string) { console.warn(msg); }
function dbgErr(msg:string) { console.error(msg); }
