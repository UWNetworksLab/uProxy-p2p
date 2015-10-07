/// <reference path='../../../third_party/typings/freedom/freedom-module-env.d.ts' />

import churn = require('../churn/churn');
import logging = require('../logging/logging');
import loggingTypes = require('../loggingprovider/loggingprovider.types');
import peerconnection = require('../webrtc/peerconnection');
import signals = require('../webrtc/signals');

var loggingController = freedom['loggingcontroller']();
loggingController.setDefaultFilter(loggingTypes.Destination.console,
                                   loggingTypes.Level.debug);

export var log :logging.Log = new logging.Log('copypaste chat');

var config :freedom.RTCPeerConnection.RTCConfiguration = {
  iceServers: [{urls: ['stun:stun.l.google.com:19302']},
               {urls: ['stun:stun1.l.google.com:19302']}]
};

var freedomParentModule = freedom();

var pc = peerconnection.createPeerConnection(config);

// Forward signalling channel messages to the UI.
pc.signalForPeerQueue.setSyncHandler((message:signals.Message) => {
  // FIXME: Does signalForPeer want a ChurnSignallingMessage?  How is the stage
  // value supposed to get filled in.
  freedomParentModule.emit('signalForPeer', message);
});

// Receive signalling channel messages from the UI.
freedomParentModule.on('handleSignalMessage', (message:signals.Message) => {
  pc.handleSignalMessage(message);
});

export var connectDataChannel = (channel:peerconnection.DataChannel) => {
	// Send messages over the datachannel, in response to events from the UI,
	// and forward messages received on the datachannel to the UI.
	freedomParentModule.on('send', (message:string) => {
    channel.send({ str: message }).catch((e:Error) => {
			log.error('error sending message: ' + e.message);
		});
	});
	channel.dataFromPeerQueue.setSyncHandler((d:peerconnection.Data) => {
		if (d.str === undefined) {
			log.error('only text messages are supported');
			return;
		}
		freedomParentModule.emit('receive', d.str);
	});
};

// TODO: This is messy...would be great just to have both sides
//       call onceConnected but it doesn't seem to fire :-/
pc.peerOpenedChannelQueue.setSyncHandler((channel:peerconnection.DataChannel) => {
  log.info('peer opened datachannel!');
	connectDataChannel(channel);
  freedomParentModule.emit('ready', {});
});

// Negotiate a peerconnection.
freedomParentModule.on('start', () => {
  pc.negotiateConnection().then(() => {
      pc.openDataChannel('text').then((channel:peerconnection.DataChannel) => {
      log.info('datachannel open!');
		  connectDataChannel(channel);
      freedomParentModule.emit('ready', {});
    }, (e) => {
      log.error('could not setup datachannel: ' + e.message);
      freedomParentModule.emit('error', {});
    });
  }, (e) => {
    log.error('could not negotiate peerconnection: ' + e.message);
  });
});
