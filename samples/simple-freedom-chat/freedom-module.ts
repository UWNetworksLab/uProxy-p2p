/// <reference path='../../../third_party/freedom/freedom-module-env.d.ts' />

import Logging = require('../../logging/logging');

import WebRtcTypes = require('../../webrtc/types');
import WebRtc = require('../../webrtc/webrtc');

import PeerConnection = WebRtcTypes.PeerConnection;
import SignallingMessage = WebRtcTypes.SignallingMessage;
import PeerConnectionConfig = WebRtcTypes.PeerConnectionConfig;
import DataChannel = WebRtcTypes.Channel;
import Data = WebRtcTypes.Data;

import Message = require('./messages.i');


var log :Logging.Log = new Logging.Log('freedomchat');

var parentFreedomModule = freedom();

function connectDataChannel(name:string, d:DataChannel) {
    d.onceOpened.then(() => {
      log.info(name + ': onceOpened: ' +
          d.toString());
    });
    d.onceClosed.then(() => {
      log.info(name + ': onceClosed: ' +
          d.toString());
    });
    d.dataFromPeerQueue.setSyncHandler((data:Data) => {
      log.info(name + ': dataFromPeer: ' + JSON.stringify(data));
      // Handle messages received on the datachannel(s).
      parentFreedomModule.emit('receive' + name, {
        message: data.str
      });
    });

  parentFreedomModule.on('send' + name, (message:Message) => {
    d.send({str: message.message})
  });
}

// Make a peer connection which logs stuff that happens.
function makePeerConnection(name:string) {
  var pcConfig :PeerConnectionConfig = {
    webrtcPcConfig: {
      iceServers: [{urls: ['stun:stun.l.google.com:19302']},
                   {urls: ['stun:stun1.l.google.com:19302']}]
    },
    peerName: name
  };
  var pc :PeerConnection<SignallingMessage> = WebRtc.createPeerConnection(pcConfig);
  pc.onceConnecting.then(() => { log.info(name + ': connecting...'); });
  pc.onceConnected.then(() => {
    log.info(name + ' connected');
  });
  pc.onceDisconnected.then(() => {
    log.info(name + ': onceDisconnected');
  });
  pc.peerOpenedChannelQueue.setSyncHandler((d:DataChannel) => {
    log.info(name + ': peerOpenedChannelQueue: ' + d.toString());
    connectDataChannel(name, d);
  });

  return pc;
}

var a :PeerConnection<SignallingMessage> = makePeerConnection('A');
var b :PeerConnection<SignallingMessage> = makePeerConnection('B')

// Connect the two signalling channels. Normally, these messages would be sent
// over the internet.
a.signalForPeerQueue.setSyncHandler((signal:SignallingMessage) => {
  log.info('a: sending signal to b.');
  b.handleSignalMessage(signal);
});
b.signalForPeerQueue.setSyncHandler((signal:SignallingMessage) => {
  log.info('b: sending signal to a.');
  a.handleSignalMessage(signal);
});

// Negotiate a peerconnection. Once negotiated, enable the UI and add
// send/receive handlers.
a.negotiateConnection()
  .then(() => {
    log.info('a: negotiated connection');
  }, (e:any) => {
    log.error('could not negotiate peerconnection: ' + e.message);
    parentFreedomModule.emit('error', {})
  })
  .then(() => { return a.openDataChannel('text'); })
  .then((aTextDataChannel:DataChannel) => {
    connectDataChannel('A', aTextDataChannel);
    parentFreedomModule.emit('ready', {});
    // Change logging tolerance once connected.
    // TODO: cleanup provider to show that we are supposed to do that.
    freedom['loggingcontroller']().setConsoleFilter("*:I");
  })
  .catch((e:any) => {
    log.error('error while opening datachannel: ' + e.message);
    parentFreedomModule.emit('error', {})
  });
