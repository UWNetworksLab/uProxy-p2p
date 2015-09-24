/// <reference path='../../../../third_party/typings/freedom/freedom-module-env.d.ts' />

import logging = require('../../logging/logging');
import loggingTypes = require('../../loggingprovider/loggingprovider.types');

import signals = require('../../webrtc/signals');
import peerconnection = require('../../webrtc/peerconnection');
import PeerConnection = peerconnection.PeerConnection;
import DataChannel = peerconnection.DataChannel;
import Data = peerconnection.Data;

export var loggingController = freedom['loggingcontroller']();
loggingController.setDefaultFilter(loggingTypes.Destination.console,
    loggingTypes.Level.debug);
loggingController.setDefaultFilter(loggingTypes.Destination.buffered,
    loggingTypes.Level.debug);


export var moduleName = 'copypaste-socks';
export var log :logging.Log = new logging.Log(moduleName);

var pcConfig :freedom.RTCPeerConnection.RTCConfiguration = {
    iceServers: [{urls: ['stun:stun.l.google.com:19302']},
                 {urls: ['stun:stun1.l.google.com:19302']}]
};

export var parentModule = freedom();

export function connectDataChannel(d:DataChannel) {
  d.dataFromPeerQueue.setSyncHandler((data:Data) => {
    parentModule.emit('messageFromPeer', data.str);
  });

  parentModule.on('messageFromPeer', (message:string) => {
    d.send({ str: message }).catch((e) => {
      log.error('error sending chat message: ' + e.message);
    });
  });
}

export function makePeerConnection() : PeerConnection<signals.Message> {
  var pc :PeerConnection<signals.Message> =
      peerconnection.createPeerConnection(pcConfig);

  pc.signalForPeerQueue.setSyncHandler((message:signals.Message) => {
    parentModule.emit('signalForPeer', message);
  });

  pc.onceConnected.then(() => {
    log.info(moduleName + ' connected');
  }, (e:Error) => {
    log.error('%1 failed to connect: %2', moduleName, e.message);
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

export var pc :PeerConnection<signals.Message>;

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
parentModule.on('signalFromPeer', (message:signals.Message) => {
  if (pc === undefined) {
    pc = makePeerConnection();
  }
  pc.handleSignalMessage(message);
});
