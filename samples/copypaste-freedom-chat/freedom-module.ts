import Logging = require('../logging/logging');

import DataChannelInterfaces = require('../../webrtc/datachannel.i');
import PeerConnectionInterfaces = require('../../webrtc/peerconnection.i');
import WebRtc = require('../../webrtc/webrtc');

import PeerConnection = PeerConnectionInterfaces.PeerConnection;
import SignallingMessage = PeerConnectionInterfaces.SignallingMessage;
import DataChannel = DataChannelInterfaces.Channel;
import Data = DataChannelInterfaces.Data;
import PeerConnectionConfig = DataChannelInterfaces.PeerConnectionConfig;

var log :Logging.Log = new Logging.Log('copypaste-socks');

var pcConfig :PeerConnectionConfig = {
  webrtcPcConfig: {
    iceServers: [{urls: ['stun:stun.l.google.com:19302']},
                 {urls: ['stun:stun1.l.google.com:19302']}]
  },
  peerName: 'pc'
};

function connectDataChannel(d:DataChannel) {
  d.dataFromPeerQueue.setSyncHandler((data:Data) => {
    freedom().emit('messageFromPeer', data.str);
  });

  freedom().on('messageFromPeer', (message:string) => {
    d.send({ str: message }).catch((e) => {
      log.error('error sending chat message: ' + e.message);
    });
  });
}

function makePeerConnection() : PeerConnection {
  var pc :PeerConnection = WebRtc.createPeerConnection(pcConfig);

  pc.signalForPeerQueue.setSyncHandler((signal:SignallingMessage) => {
    freedom().emit('signalForPeer', signal);
  });

  pc.onceConnected.then(() => {
    log.info('connected');
  });

  pc.peerOpenedChannelQueue.setSyncHandler((d:DataChannel) => {
    if (d.getLabel() === 'text') {
      connectDataChannel(d);
      freedom().emit('ready');
    }
  });

  return pc;
}

var pc :PeerConnection;

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
freedom().on('signalFromPeer', (signal:SignallingMessage) => {
  if (pc === undefined) {
    pc = makePeerConnection();
  }
  pc.handleSignalMessage(signal);
});
