/// <reference path='../../freedom/typings/freedom-module-env.d.ts' />
/// <reference path="../../freedom/typings/rtcpeerconnection.d.ts" />

import Logging = require('../../logging/logging');

import WebRtcTypes = require('../../webrtc/webrtc.types');
import WebRtc = require('../../webrtc/webrtc');

import PeerConnection = WebRtcTypes.PeerConnection;
import SignallingMessage = WebRtcTypes.SignallingMessage;
import DataChannel = WebRtcTypes.Channel;
import Data = WebRtcTypes.Data;

var log :Logging.Log = new Logging.Log('copypaste-socks');

var pcConfig :freedom_RTCPeerConnection.RTCConfiguration = {
    iceServers: [{urls: ['stun:stun.l.google.com:19302']},
                 {urls: ['stun:stun1.l.google.com:19302']}]
};

var parentModule = freedom();

function connectDataChannel(d:DataChannel) {
  d.dataFromPeerQueue.setSyncHandler((data:Data) => {
    parentModule.emit('messageFromPeer', data.str);
  });

  parentModule.on('messageFromPeer', (message:string) => {
    d.send({ str: message }).catch((e) => {
      log.error('error sending chat message: ' + e.message);
    });
  });
}

function makePeerConnection() : PeerConnection<SignallingMessage> {
  var pc :PeerConnection<SignallingMessage> =
      WebRtc.createPeerConnection(pcConfig);

  pc.signalForPeerQueue.setSyncHandler((signal:SignallingMessage) => {
    parentModule.emit('signalForPeer', signal);
  });

  pc.onceConnected.then(() => {
    log.info('connected');
  });

  pc.peerOpenedChannelQueue.setSyncHandler((d:DataChannel) => {
    if (d.getLabel() === 'text') {
      log.info('connected data channel');
      connectDataChannel(d);
      parentModule.emit('ready');
    } else {
      log.info('ignored created data channel: ' + d.getLabel());
    }
  });

  return pc;
}

var pc :PeerConnection<SignallingMessage>;

parentModule.on('start', () => {
  pc = makePeerConnection();
  pc.negotiateConnection()
    .then(() => {
      return pc.openDataChannel('text');
    })
    .then(connectDataChannel)
    .then(() => {
      parentModule.emit('ready');
    })
    .catch((e:Error) => {
      log.error('could not negotiate peerconnection: ' + e.message);
    });
});

// Receive signalling channel messages from the UI.
// If pc doesn't exist yet then we are responding to the remote
// peer's initiation.
parentModule.on('signalFromPeer', (signal:SignallingMessage) => {
  if (pc === undefined) {
    pc = makePeerConnection();
  }
  pc.handleSignalMessage(signal);
});
