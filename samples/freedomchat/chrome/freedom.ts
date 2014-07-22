/// <reference path="../../../peerconnection/peerconnection.d.ts" />
/// <reference path="../../../coreproviders/interfaces/uproxypeerconnection.d.ts" />
/// <reference path="../../../freedom-typescript-api/interfaces/freedom.d.ts" />
/// <reference path="../../../third_party/typings/tsd.d.ts" />

var pcConfig :WebRtc.PeerConnectionConfig = {
  webrtcPcConfig: {
    iceServers: [{url: 'stun:stun.l.google.com:19302'},
                 {url: 'stun:stun1.l.google.com:19302'}]
  },
  webrtcMediaConstraints: {
    optional: [{DtlsSrtpKeyAgreement: true}]
  }
};

var a :UproxyPeerConnection = freedom['core.uproxypeerconnection'](
    JSON.stringify(pcConfig));
var b :UproxyPeerConnection = freedom['core.uproxypeerconnection'](
    JSON.stringify(pcConfig));

// Connect the two signalling channels.
// Normally, these messages would be sent over the internet.
a.on('signalMessage', (signal:SignallingMessage) => {
  console.log('signalling channel A message: ' + signal.message);
  b.handleSignalMessage(signal);
});
b.on('signalMessage', (signal:SignallingMessage) => {
  console.log('signalling channel B message: ' + signal.message);
  a.handleSignalMessage(signal);
});

// // Log the chosen endpoints.
// function logEndpoints(name:string, endpoints:WebRtc.ConnectionAddresses) {
//   dbg(name + ' connected: ' +
//       endpoints.local.address + ':' + endpoints.local.port +
//       ' <-> ' +
//       endpoints.remote.address + ':' + endpoints.remote.port);
// }
// a.onceConnected.then(logEndpoints.bind(null, 'a'));
// b.onceConnected.then(logEndpoints.bind(null, 'b'));

// // Have a negotiate a peerconnection.
// // Once negotiated, enable the UI and add send/receive handlers.
a.negotiateConnection().then((endpoints:ConnectionAddresses) => {
  console.log('connected: ' +
      endpoints.localAddress + ':' + endpoints.localPort +
      ' <-> ' +
      endpoints.remoteAddress + ':' + endpoints.remotePort);

//   sendAreaA.disabled = false;
//   sendAreaB.disabled = false;

//   // Send messages over the datachannel, in response to events
//   // arriving from the UI.
//   function send(pc:WebRtc.PeerConnection, textArea:HTMLInputElement) {
//     pc.dataChannels['text'].send({
//       str: textArea.value || '(empty message)'
//     }).catch((e) => {
//       dbgErr('could not send: ' + e.message); }
//     );
//   }
//   sendButtonA.onclick = send.bind(null, a, sendAreaA);
//   sendButtonB.onclick = send.bind(null, b, sendAreaB);

//   // Handle messages received on the datachannel(s).
//   // The message is forwarded to the UI.
//   // TODO: only the first message sent over the data channel is received
//   function receive(textArea:HTMLInputElement, d:WebRtc.Data) {
//     textArea.value = d.str;
//   }
//   var chanA = a.openDataChannel('text');
//   chanA.onceOpened.then(() => {
//     chanA.fromPeerDataQueue.setSyncHandler(receive.bind(null, receiveAreaA));
//   });
//   b.peerCreatedChannelQueue.setSyncHandler((chanB:WebRtc.DataChannel) => {
//     chanB.fromPeerDataQueue.setSyncHandler(receive.bind(null, receiveAreaB));
//   });
}, (e) => {
  dbgErr('could not negotiate peerconnection: ' + e.message);
});
