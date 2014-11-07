/// <reference path='messages.d.ts' />
/// <reference path='../../logging/logging.d.ts' />
/// <reference path="../../webrtc/peerconnection.d.ts" />
/// <reference path="../../third_party/typings/tsd.d.ts" />
/// <reference path="../../freedom/typings/freedom.d.ts" />

var log :Logging.Log = new Logging.Log('freedomchat');

function connectDataChannel(name:string, d:WebRtc.DataChannel) {
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
      freedom().emit('receive' + name, {
        message: data.str
      });
    });

  freedom().on('send' + name, (message:Chat.Message) => {
    d.send({str: message.message})
  });
}

// Make a peer connection which logs stuff that happens.
function makePeerConnection(name:string) {
  var pcConfig :WebRtc.PeerConnectionConfig = {
    webrtcPcConfig: {
      iceServers: [{urls: ['stun:stun.l.google.com:19302']},
                   {urls: ['stun:stun1.l.google.com:19302']}]
    },
    peerName: name
  };
  var pc : WebRtc.PeerConnection = new WebRtc.PeerConnection(pcConfig);
  pc.onceConnecting.then(() => { log.info(name + ': connecting...'); });
  pc.onceConnected.then((endpoints:WebRtc.ConnectionAddresses) => {
    log.info(name + ' connected: ' +
        endpoints.local.address + ':' + endpoints.local.port +
        ' (' + endpoints.localType + ') <-> ' +
        endpoints.remote.address + ':' + endpoints.remote.port +
        ' (' + endpoints.remoteType + ')');
  });
  pc.onceDisconnected.then(() => {
    log.info(name + ': onceDisconnected');
  });
  pc.peerOpenedChannelQueue.setSyncHandler((d:WebRtc.DataChannel) => {
    log.info(name + ': peerOpenedChannelQueue: ' + d.toString());
    connectDataChannel(name, d);
  });

  return pc;
}

var a :WebRtc.PeerConnection = makePeerConnection('A');
var b :WebRtc.PeerConnection = makePeerConnection('B')

// Connect the two signalling channels. Normally, these messages would be sent
// over the internet.
a.signalForPeerQueue.setSyncHandler((signal:WebRtc.SignallingMessage) => {
  log.info('a: sending signal to b.');
  b.handleSignalMessage(signal);
});
b.signalForPeerQueue.setSyncHandler((signal:WebRtc.SignallingMessage) => {
  log.info('b: sending signal to a.');
  a.handleSignalMessage(signal);
});

// Negotiate a peerconnection. Once negotiated, enable the UI and add
// send/receive handlers.
a.negotiateConnection()
  .then((endpoints:WebRtc.ConnectionAddresses) => {
    log.info('a: negotiated connection to: ' + JSON.stringify(endpoints));
  }, (e:any) => {
    log.error('could not negotiate peerconnection: ' + e.message);
    freedom().emit('error', {})
  })
  .then(() => { return a.openDataChannel('text'); })
  .then((aTextDataChannel:WebRtc.DataChannel) => {
    connectDataChannel('A', aTextDataChannel);
    freedom().emit('ready', {});
  })
  .catch((e:any) => {
    log.error('error while opening datachannel: ' + e.message);
    freedom().emit('error', {})
  });
