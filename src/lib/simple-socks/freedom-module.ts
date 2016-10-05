/// <reference path='../../../third_party/typings/index.d.ts' />

import session = require('../socks/session');
import piece = require('../socks/piece');
import socks_headers = require('../socks/headers');

import freedom_server = require('../socks/freedom/server');
import freedom_socket = require('../socks/freedom/socket');

import logging = require('../logging/logging');
import loggingTypes = require('../loggingprovider/loggingprovider.types');

import net = require('../net/net.types');
import peerconnection = require('../webrtc/peerconnection');
import peerconnection_types = require('../webrtc/signals');

import socks_to_rtc = require('../socks-to-rtc/socks-to-rtc');
import tcp = require('../net/tcp');
import Pool = require('../pool/pool');

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

// ====================================
// BACKWARDS COMPATIBLE VERSION FOLLOWS
// ====================================

// giver.signalForPeerQueue.setSyncHandler(getter.handleSignalMessage);

// const giverPool = new Pool(giver, 'giver');
// giver.onceConnected.then(() => {
//   log.info('giver connected!');
//   giverPool.peerOpenedChannelQueue.setSyncHandler((channel) => {
//     const sessionId = channel.getLabel();
//     log.info('%1: new socks session', sessionId);
//     const socksSession = new session.SocksSession(sessionId);

//     enum CompatStates {
//       NEW,
//       SOCKS_TO_RTC_HANDSHAKE,
//       SOCKS_TO_RTC_RESPONSE,
//       PASSTHROUGH
//     };
//     let state = CompatStates.NEW;

//     // datachannel -> SOCKS session.
//     channel.dataFromPeerQueue.setSyncHandler((data) => {
//       if (data.str) {
//         log.debug('%1: SocksToRtc detected, running in compatibility mode', sessionId);
//         state = CompatStates.SOCKS_TO_RTC_HANDSHAKE;

//         const handshakeBytes = socks_headers.composeAuthHandshakeBuffer([socks_headers.Auth.NOAUTH]);
//         socksSession.handleDataFromSocksClient(handshakeBytes);

//         // convert from JSON -> bytes
//         try {
//           const socksRequest = socks_headers.composeRequestBuffer(JSON.parse(data.str));
//           socksSession.handleDataFromSocksClient(socksRequest);
//         } catch (e) {
//           log.warn('%1: could not decode SocksToRtc-style request: %2', sessionId, e.message);
//           // TODO: close the channel
//         }
//       } else {
//         socksSession.handleDataFromSocksClient(data.buffer);
//       }
//     });

//     // datachannel <- SOCKS session
//     socksSession.onDataForSocksClient((bytes:ArrayBuffer) => {
//       switch (state) {
//         // SocksToRtc does not need the handshake response; filter it out here. 
//         case CompatStates.SOCKS_TO_RTC_HANDSHAKE:
//           log.debug('%1: filtering AUTH handshake for SocksToRtc mode', sessionId);
//           state = CompatStates.SOCKS_TO_RTC_RESPONSE;
//           break;
//         case CompatStates.SOCKS_TO_RTC_RESPONSE:
//           log.debug('%1: translating SOCKS response for SocksToRtc mode', sessionId);
//           state = CompatStates.PASSTHROUGH;
//           try {
//             const responseJson = JSON.stringify(socks_headers.interpretResponseBuffer(bytes));
//             channel.send({
//               str: responseJson
//             });
//           } catch (e) {
//             log.warn('%1: could not encode response: %2', sessionId, e.message);
//             // TODO: close the channel
//           }
//         case CompatStates.PASSTHROUGH:
//           channel.send({
//             buffer: bytes
//           });
//           break;
//         default:
//           log.warn('%1: data for socks client received in unexpected state %2', sessionId, CompatStates[state]);
//       }
//     });

//     socksSession.onDisconnect(() => {
//       log.info('%1: forwarding socket terminated, closing datachannel', sessionId);
//       // TODO: destroy the socket

//       // TODO: WTF as soon as i point firefox at this server, close() returns undefined??? 
//       channel.close().catch((e) => {
//         log.error('%1: failed to close datachannel: %1', sessionId, e);
//       })

//     });
//     channel.onceClosed.then(() => {
//       log.info('%1: channel closed, discarding session', sessionId);
//       socksSession.handleDisconnect();
//     });

//     socksSession.onForwardingSocketRequired((host:string, port:number) => {
//       const forwardingSocket = new freedom_socket.FreedomForwardingSocket();

//       return forwardingSocket.connect(host, port).then(() => {
//         return forwardingSocket;
//       });
//     });
//   });
// });

// const socksToRtc = new socks_to_rtc.SocksToRtc();
// socksToRtc.start(new tcp.Server({
//   address: SERVER_ADDRESS,
//   port: SERVER_PORT
// }), getter).then((endpoint: net.Endpoint) => {
//   log.info('SocksToRtc listening on %1', endpoint);
//   log.info('curl -x socks5h://%1:%2 www.example.com', endpoint.address, endpoint.port);
// }, (e) => {
//   log.error('failed to start SocksToRtc: %1', e.message);
// });
// socksToRtc.signalsForPeer.setSyncHandler(giver.handleSignalMessage);

// ===============================================
// NON-BACKWARDS COMPATIBLE WEBRTC VERSION FOLLOWS
// ===============================================

// giver.signalForPeerQueue.setSyncHandler(getter.handleSignalMessage);
// getter.signalForPeerQueue.setSyncHandler(giver.handleSignalMessage);

// giver.onceConnected.then(() => {
//   log.info('giver connected!');
//   giver.peerOpenedChannelQueue.setSyncHandler((channel) => {
//     const sessionId = channel.getLabel();
//     log.info('%1: new socks session', sessionId);
//     const socksSession = new session.SocksSession(SERVER_NAME, sessionId);

//     // datachannel -> SOCKS session
//     channel.dataFromPeerQueue.setSyncHandler((data) => {
//       socksSession.handleDataFromSocksClient(data.buffer);
//     });
//     // datachannel <- SOCKS session
//     socksSession.onDataForSocksClient((bytes) => {
//       channel.send({
//         buffer: bytes
//       });
//     });

//     socksSession.onDisconnect(() => {
//       log.info('%1: forwarding socket terminated, closing datachannel', sessionId);
//       // TODO: destroy the socket
//       channel.close().catch((e) => {
//         log.error('%1: failed to close datachannel: %1', sessionId, e);
//       })
//     });
//     channel.onceClosed.then(() => {
//       log.info('%1: channel closed, discarding session', sessionId);
//       socksSession.handleDisconnect();
//     });

//     socksSession.onForwardingSocketRequired((host, port) => {
//       const forwardingSocket = new freedom_socket.FreedomForwardingSocket();
//       return forwardingSocket.connect(host, port).then(() => {
//         return forwardingSocket;
//       });
//     });
//   });
// });

// getter.negotiateConnection().then(() => {
//   log.info('getter connected!');

//   let numSessions = 0;
//   new freedom_server.FreedomSocksServer(SERVER_ADDRESS, SERVER_PORT, SERVER_NAME).onConnection(() => {
//     const sessionId = 'p' + (numSessions++) + 'p';
//     log.info('new SOCKS client %1', sessionId);
//     return getter.openDataChannel(sessionId).then((channel) => {
//       log.info('opened datachannel for SOCKS client %1', sessionId);
//       return {
//         // forward data from the socks client across the datachannel to the remote peer.
//         handleDataFromSocksClient: (bytes: ArrayBuffer) => {
//           channel.send({
//             buffer: bytes
//           });
//         },
//         // forward data from the channel to the socks client.
//         onDataForSocksClient: (callback: (buffer: ArrayBuffer) => void) => {
//           channel.dataFromPeerQueue.setSyncHandler((data) => {
//             callback(data.buffer);
//           });
//           return this;
//         },
//         // the socks client has disconnected - close the datachannel.
//         handleDisconnect: () => {
//           log.info('%1: socks client disconnected, closing datachannel', sessionId);
//           channel.close().catch((e) => {
//             log.error('%1: failed to close datachannel: %1', sessionId, e);
//           })
//         },
//         onDisconnect: (callback: () => void) => {
//           log.info('%1: forwarding socket disconnected, notifying socks client', sessionId);
//           // TODO: close the datachannel
//           return this;
//         }
//       };
//       // TODO: handle channel closure
//     });
//   }).listen().then(() => {
//     log.info('curl -x socks5h://%1:%2 www.example.com', SERVER_ADDRESS, SERVER_PORT);
//   }, (e) => {
//     log.error('failed to start SOCKS server: %1', e.message);
//   });
// }, (e) => {
//   log.error('failed to open peerconnection: %1', e);
// });

// ==========================
// NON-WEBRTC VERSION FOLLOWS
// ==========================
let numSessions = 0;
new freedom_server.FreedomSocksServer(SERVER_ADDRESS, SERVER_PORT, SERVER_NAME).onConnection(() => {
  const clientId = 'p' + (numSessions++) + 'p';
  log.info('new SOCKS session %1', clientId);
  return new session.SocksSession(clientId).onForwardingSocketRequired((host, port) => {
    const forwardingSocket = new freedom_socket.FreedomForwardingSocket();
    // TODO: destroy the socket on disconnect
    return forwardingSocket.connect(host, port).then(() => {
      return forwardingSocket;
    });
  });
}).listen().then(() => {
  log.info('curl -x socks5h://%1:%2 www.example.com', SERVER_ADDRESS, SERVER_PORT);
}, (e) => {
  log.error('failed to start SOCKS server: %1', e.message);
});
