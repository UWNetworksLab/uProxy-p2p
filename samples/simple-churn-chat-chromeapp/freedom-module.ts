/// <reference path='../../../../third_party/freedom-typings/freedom-module-env.d.ts' />

import logging = require('../../logging/logging');
import loggingTypes = require('../../loggingprovider/loggingprovider.types');

import churn = require('../../churn/churn');
import churn_types = require('../../churn/churn.types');
import signals = require('../../webrtc/signals');
import peerconnection = require('../../webrtc/peerconnection');
import PeerConnection = peerconnection.PeerConnection;
import DataChannel = peerconnection.DataChannel;
import Data = peerconnection.Data;

import Message = require('./message.types');

// Example of how to configure logging level:
//
//   var loggingController = freedom['loggingcontroller']();
//   loggingController.setDefaultFilter(loggingTypes.Destination.console,
//                                      loggingTypes.Level.info);

export var moduleName = 'churn chat';
export var log :logging.Log = new logging.Log(moduleName);

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
      log.info('%1: dataFromPeer: %2', name, data);
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
  var pcConfig :freedom.RTCPeerConnection.RTCConfiguration = {
    iceServers: []
  };
  var pc :PeerConnection<churn_types.ChurnSignallingMessage> =
      new churn.Connection(freedom['core.rtcpeerconnection'](pcConfig),
      'churn-' + name);
  pc.onceConnected.then(() => {
    log.info(name + ' connected');
  }, (e:Error) => {
    log.error('%1 failed to connect: %2', name, e.message);
  });
  pc.onceClosed.then(() => {
    log.info(name + ': onceClosed');
  });
  pc.peerOpenedChannelQueue.setSyncHandler((d:DataChannel) => {
    log.info(name + ': peerOpenedChannelQueue: ' + d.toString());
    connectDataChannel(name, d);
  });

  return pc;
}

var a :PeerConnection<signals.Message> = makePeerConnection('A');
var b :PeerConnection<signals.Message> = makePeerConnection('B')

// Connect the two signalling channels. Normally, these messages would be sent
// over the internet.
a.signalForPeerQueue.setSyncHandler((message:signals.Message) => {
  log.info('a: sending signalling message to b.');
  b.handleSignalMessage(message);
});
b.signalForPeerQueue.setSyncHandler((message:signals.Message) => {
  log.info('b: sending signalling message to a.');
  a.handleSignalMessage(message);
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

    parentFreedomModule.on('stop', () => {
      a.close();
    });
  })
  .catch((e:any) => {
    log.error('error while opening datachannel: ' + e.message);
    parentFreedomModule.emit('error', {})
  });
