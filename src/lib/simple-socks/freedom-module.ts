/// <reference path='../../../third_party/typings/index.d.ts' />

import session = require('../socks/session');
import piece = require('../socks/piece');

import freedom_server = require('../socks/freedom/server');
import freedom_socket = require('../socks/freedom/socket');

import logging = require('../logging/logging');
import loggingTypes = require('../loggingprovider/loggingprovider.types');

import net = require('../net/net.types');
import peerconnection = require('../webrtc/peerconnection');
import peerconnection_types = require('../webrtc/signals');

declare const freedom: freedom.FreedomInModuleEnv;

const loggingController = freedom['loggingcontroller']();
loggingController.setDefaultFilter(loggingTypes.Destination.console,
  loggingTypes.Level.debug);

const log = new logging.Log('simple socks');

const SERVER_ADDRESS = '0.0.0.0';
const SERVER_PORT = 9999;
const SERVER_NAME = 'sample';

const PEERCONNECTION_CONFIG: freedom.RTCPeerConnection.RTCConfiguration = {
  iceServers: [
    {
      urls: [
        'stun:stun.l.google.com:19302'
      ]
    }
  ]
};

const getter = peerconnection.createPeerConnection(PEERCONNECTION_CONFIG);
const giver = peerconnection.createPeerConnection(PEERCONNECTION_CONFIG);

getter.signalForPeerQueue.setSyncHandler(giver.handleSignalMessage);
giver.signalForPeerQueue.setSyncHandler(getter.handleSignalMessage);

// setup the giver to respond on new datachannels.
giver.onceConnected.then(() => {
  log.info('giver connected!');
  giver.peerOpenedChannelQueue.setSyncHandler((channel) => {
    const sessionId = channel.getLabel();
    log.info('%1: new socks session', sessionId);
    const socksSession = new session.SocksSession(SERVER_NAME, sessionId);
    socksSession.onForwardingSocketRequired((host, port) => {
      const forwardingSocket = new freedom_socket.FreedomForwardingSocket();

      // datachannel -> SOCKS session
      channel.dataFromPeerQueue.setSyncHandler((data) => {
        socksSession.handleDataFromSocksClient(data.buffer);
      });
      // datachannel <- SOCKS session
      socksSession.onDataForSocksClient((bytes) => {
        channel.send({
          buffer: bytes
        });
      });

      socksSession.onDisconnect(() => {
        log.info('%1: forwarding socket terminated, closing datachannel', sessionId);
        // TODO: destroy the socket
        channel.close().catch((e) => {
          log.error('%1: failed to close datachannel: %1', sessionId, e);
        })
      });
      channel.onceClosed.then(() => {
        log.info('%1: channel closed, discarding session', sessionId);
        socksSession.handleDisconnect();
      });

      return forwardingSocket.connect(host, port).then(() => {
        return forwardingSocket;
      });
    });
  });
});

// create the peerconnection and start the SOCKS server.
getter.negotiateConnection().then(() => {
  log.info('getter connected!');

  let numSessions = 0;
  new freedom_server.FreedomSocksServer(SERVER_ADDRESS, SERVER_PORT, SERVER_NAME).onConnection(() => {
    const sessionId = 'p' + (numSessions++) + 'p';
    log.info('new SOCKS client %1', sessionId);
    return getter.openDataChannel(sessionId).then((channel) => {
      log.info('opened datachannel for SOCKS client %1', sessionId);
      return {
        // forward data from the socks client across the datachannel to the remote peer.
        handleDataFromSocksClient: (bytes: ArrayBuffer) => {
          channel.send({
            buffer: bytes
          });
        },
        // forward data from the channel to the socks client.
        onDataForSocksClient: (callback: (buffer: ArrayBuffer) => void) => {
          channel.dataFromPeerQueue.setSyncHandler((data) => {
            callback(data.buffer);
          });
          return this;
        },
        // the socks client has disconnected - close the datachannel.
        handleDisconnect: () => {
          log.info('%1: socks client disconnected, closing datachannel', sessionId);
          channel.close().catch((e) => {
            log.error('%1: failed to close datachannel: %1', sessionId, e);
          })
        },
        onDisconnect: (callback: () => void) => {
          log.info('%1: forwarding socket disconnected, notifying socks client', sessionId);
          // TODO: close the datachannel
          return this;
        }
      };
      // TODO: handle channel closure
    });
  }).listen().then(() => {
    log.info('curl -x socks5h://%1:%2 www.example.com', SERVER_ADDRESS, SERVER_PORT);
  }, (e) => {
    log.error('failed to start SOCKS server: %1', e.message);
  });
}, (e) => {
  log.error('failed to open peerconnection: %1', e);
});

// NON-WEBRTC VERSION FOLLOWS
// ==========================
// let numSessions = 0;
// new freedom_server.FreedomSocksServer(SERVER_ADDRESS, SERVER_PORT, SERVER_NAME).onConnection(() => {
//   const clientId = 'p' + (numSessions++) + 'p';
//   log.info('new SOCKS session %1', clientId);
//   const socksSession = new session.SocksSession(SERVER_NAME, clientId);
//   socksSession.onForwardingSocketRequired((host, port) => {
//     const forwardingSocket = new freedom_socket.FreedomForwardingSocket();
//     // TODO: destroy the socket on disconnect
//     return forwardingSocket.connect(host, port).then(() => {
//       return forwardingSocket;
//     });
//   });
//   return socksSession;
// }).listen().then(() => {
//   log.info('curl -x socks5h://%1:%2 www.example.com', SERVER_ADDRESS, SERVER_PORT);
// }, (e) => {
//   log.error('failed to start SOCKS server: %1', e.message);
// });
