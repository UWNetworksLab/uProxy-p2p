/// <reference path='messages.d.ts' />
/// <reference path="../../../webrtc/peerconnection.d.ts" />
/// <reference path="../../../freedom/coreproviders/uproxypeerconnection.d.ts" />
/// <reference path="../../../freedom/coreproviders/uproxylogging.d.ts" />
/// <reference path="../../../freedom/typings/freedom.d.ts" />
/// <reference path="../../../third_party/typings/tsd.d.ts" />

import WebrtcLib = freedom_UproxyPeerConnection;

var log :Freedom_UproxyLogging.Log = freedom['core.log']('freedomchat');
//log.debug('test debug message');
//log.info('test info message');
//log.warn('test warn message');
//log.error('test error message');

// Make a peer connection which logs stuff that happens.
function makePeerConnection(name:string) {
  var pcConfig :WebRtc.PeerConnectionConfig = {
    webrtcPcConfig: {
      iceServers: [{url: 'stun:stun.l.google.com:19302'},
                   {url: 'stun:stun1.l.google.com:19302'}]
    },
    webrtcMediaConstraints: {
      optional: [{DtlsSrtpKeyAgreement: true}]
    },
    peerName: name
  };
  var pc :WebrtcLib.Pc = freedom['core.uproxypeerconnection'](pcConfig);
  pc.onceConnecting().then(() => { log.info(name + ': connecting...'); });
  pc.onceConnected().then((endpoints:WebRtc.ConnectionAddresses) => {
    log.info(name + ' connected: ' +
        endpoints.local.address + ':' + endpoints.local.port +
        ' (' + WebRtc.CandidateType[endpoints.localType] + ') <-> ' +
        endpoints.remote.address + ':' + endpoints.remote.port +
        ' (' + WebRtc.CandidateType[endpoints.remoteType] + ')');
  });
  pc.onceDisconnected().then(() => {
    log.info(name + ': onceDisonnected');
  });
  pc.on('peerOpenedChannel', (channelLabel:string) => {
    log.info(name + ': peerOpenedChannel(' + channelLabel + ')');
    pc.onceDataChannelOpened(channelLabel).then(() => {
      log.info(name + ': onceDataChannelOpened(' + channelLabel + ')');
    });
    pc.onceDataChannelClosed(channelLabel).then(() => {
      log.info(name + ': onceDataChannelClosed(' + channelLabel + ')');
    });
  });
  return pc;
}

var a :WebrtcLib.Pc = makePeerConnection('a');
var b :WebrtcLib.Pc = makePeerConnection('b')

// Connect the two signalling channels. Normally, these messages would be sent
// over the internet.
a.on('signalForPeer', (signal:WebRtc.SignallingMessage) => {
  log.info('a: sending signal to b.');
  b.handleSignalMessage(signal);
});
b.on('signalForPeer', (signal:WebRtc.SignallingMessage) => {
  log.info('b: sending signal to a.');
  a.handleSignalMessage(signal);
});

// Negotiate a peerconnection. Once negotiated, enable the UI and add
// send/receive handlers.
a.negotiateConnection()
  .then((endpoints:WebRtc.ConnectionAddresses) => {
    log.info('a: negotiated connection to: ' + JSON.stringify(endpoints));

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
      log.info('a: openDataChannel(text)');
      freedom.emit('ready', {});
    }, (e) => {
      log.error('could not setup datachannel: ' + e.message);
      freedom.emit('error', {});
    });
  }, (e:Error) => {
    log.error('could not negotiate peerconnection: ' + e.message);
  });
