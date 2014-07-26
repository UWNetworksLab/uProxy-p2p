/// <reference path="../../../peerconnection/peerconnection.d.ts" />
/// <reference path="../../../coreproviders/providers/uproxypeerconnection.d.ts" />
/// <reference path="../../../freedom-declarations/freedom.d.ts" />
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

var a :freedom_UproxyPeerConnection = freedom['core.uproxypeerconnection'](
    JSON.stringify(pcConfig));
var b :freedom_UproxyPeerConnection = freedom['core.uproxypeerconnection'](
    JSON.stringify(pcConfig));

// Connect the two signalling channels.
// Normally, these messages would be sent over the internet.
a.on('signalMessage', (signal:string) => {
  console.log('signalling channel A message: ' + signal);
  b.handleSignalMessage(signal);
});
b.on('signalMessage', (signal:string) => {
  console.log('signalling channel B message: ' + signal);
  a.handleSignalMessage(signal);
});

b.on('peerCreatedChannel', (channelLabel:string) => {
  console.log('i can see that a created a data channel called ' + channelLabel);
});

// Log the chosen endpoints.
function logEndpoints(name:string, endpoints:WebRtc.ConnectionAddresses) {
  console.log(name + ' connected: ' +
      endpoints.local.address + ':' + endpoints.local.port +
      ' <-> ' +
      endpoints.remote.address + ':' + endpoints.remote.port);
}
a.onceConnected().then(logEndpoints.bind(null, 'a'));
b.onceConnected().then(logEndpoints.bind(null, 'b'));

// Negotiate a peerconnection.
// Once negotiated, enable the UI and add send/receive handlers.
a.negotiateConnection().then((endpoints:WebRtc.ConnectionAddresses) => {
  // Send messages over the datachannel, in response to events from the UI.
  var sendMessage = (pc:freedom_UproxyPeerConnection, message:Chat.Message) => {
    pc.send('text', { str: message.message }).catch((e) => {
      console.error('error sending message: ' + e.message);
    });
  };
  freedom.on('sendA', sendMessage.bind(null, a));
  freedom.on('sendB', sendMessage.bind(null, b));

  // Handle messages received on the datachannel(s).
  // The message is forwarded to the UI.
  var receiveMessage = (name:string, d:freedom_UproxyPeerConnection.LabelledDataChannelMessage) => {
    if (d.message.str === undefined) {
      console.error('only text messages are supported');
      return;
    }
    freedom.emit('receive' + name, {
      message: d.message.str
    });
  };
  a.on('fromPeerData', receiveMessage.bind(null, 'A'));
  b.on('fromPeerData', receiveMessage.bind(null, 'B'));

  a.openDataChannel('text').then(() => {
    console.log('datachannel open!');
    freedom.emit('ready', {});
  }, (e) => {
    console.error('could not setup datachannel: ' + e.message);
    freedom.emit('error', {});
  });
}, (e) => {
  dbgErr('could not negotiate peerconnection: ' + e.message);
});
