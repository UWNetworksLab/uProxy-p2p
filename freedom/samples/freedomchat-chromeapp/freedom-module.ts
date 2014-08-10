/// <reference path='messages.d.ts' />
/// <reference path="../../../webrtc/peerconnection.d.ts" />
/// <reference path="../../../freedom/coreproviders/uproxypeerconnection.d.ts" />
/// <reference path="../../../freedom/coreproviders/uproxylogging.d.ts" />
/// <reference path="../../../freedom/typings/freedom.d.ts" />
/// <reference path="../../../third_party/typings/tsd.d.ts" />

import WebrtcLib = freedom_UproxyPeerConnection;

var log :Freedom_UproxyLogging.Log = freedom['core.log']('freedomchat');

var pcConfig :WebRtc.PeerConnectionConfig = {
  webrtcPcConfig: {
    iceServers: [{url: 'stun:stun.l.google.com:19302'},
                 {url: 'stun:stun1.l.google.com:19302'}]
  },
  webrtcMediaConstraints: {
    optional: [{DtlsSrtpKeyAgreement: true}]
  }
};

var a :WebrtcLib.Pc = freedom['core.uproxypeerconnection'](pcConfig);
var b :WebrtcLib.Pc = freedom['core.uproxypeerconnection'](pcConfig);

// Connect the two signalling channels.
// Normally, these messages would be sent over the internet.
a.on('signalForPeer', (signal:WebRtc.SignallingMessage) => {
  log.info('signalling channel A message: ' + JSON.stringify(signal));
  b.handleSignalMessage(signal);
});
b.on('signalForPeer', (signal:WebRtc.SignallingMessage) => {
  log.info('signalling channel B message: ' + JSON.stringify(signal));
  a.handleSignalMessage(signal);
});

b.on('peerOpenedChannel', (channelLabel:string) => {
  log.info('I can see that `a` created a data channel called ' + channelLabel);
});

a.onceConnecting().then(() => { log.info('a is connecting...'); });
b.onceConnecting().then(() => { log.info('b is connecting...'); });

// Log the chosen endpoints.
function logEndpoints(name:string, endpoints:WebRtc.ConnectionAddresses) {
  log.info(name + ' connected: ' +
      endpoints.local.address + ':' + endpoints.local.port +
      ' <-> ' +
      endpoints.remote.address + ':' + endpoints.remote.port);
}
a.onceConnected().then(logEndpoints.bind(null, 'a'));
b.onceConnected().then(logEndpoints.bind(null, 'b'));

// Negotiate a peerconnection.
// Once negotiated, enable the UI and add send/receive handlers.
a.negotiateConnection()
  .then((endpoints:WebRtc.ConnectionAddresses) => {
    // Send messages over the datachannel, in response to events from the UI.
    var sendMessage = (pc:WebrtcLib.Pc, message:Chat.Message) => {
      pc.send('text', { str: message.message }).catch((e) => {
        log.error('error sending message: ' + e.message);
      });
    };
    freedom.on('sendA', sendMessage.bind(null, a));
    freedom.on('sendB', sendMessage.bind(null, b));

    // Handle messages received on the datachannel(s).
    // The message is forwarded to the UI.
    var receiveMessage = (name:string, d:WebrtcLib.LabelledDataChannelMessage) => {
      if (d.message.str === undefined) {
        log.error('only text messages are supported');
        return;
      }
      freedom.emit('receive' + name, {
        message: d.message.str
      });
    };
    a.on('dataFromPeer', receiveMessage.bind(null, 'A'));
    b.on('dataFromPeer', receiveMessage.bind(null, 'B'));

    a.openDataChannel('text').then(() => {
      log.info('datachannel open!');
      freedom.emit('ready', {});
    }, (e) => {
      log.error('could not setup datachannel: ' + e.message);
      freedom.emit('error', {});
    });
  }, (e:Error) => {
    log.error('could not negotiate peerconnection: ' + e.message);
  });
