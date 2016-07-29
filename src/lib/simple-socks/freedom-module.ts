/// <reference path='../../../../third_party/typings/browser.d.ts' />

import session = require('../socks/session');

import freedom_server = require('../socks/freedom/server');
import freedom_socket = require('../socks/freedom/socket');

import logging = require('../logging/logging');
import loggingTypes = require('../loggingprovider/loggingprovider.types');

declare const freedom: freedom.FreedomInModuleEnv;

const loggingController = freedom['loggingcontroller']();
loggingController.setDefaultFilter(loggingTypes.Destination.console,
  loggingTypes.Level.debug);

const log = new logging.Log('simple-socks');

const SERVER_ADDRESS = '0.0.0.0';
const SERVER_PORT = 9999;
const SERVER_NAME = 'sample';

// 100% freedomjs SOCKS server:
//   FreedomSocksServer -> SocksSession -> FreedomSocksSocket
let numSessions = 0;
new freedom_server.FreedomSocksServer(SERVER_ADDRESS, SERVER_PORT, SERVER_NAME).onConnection(() => {
  const clientId = 'p' + (numSessions++) + 'p';
  log.info('new SOCKS session %1', clientId);
  const socksSession = new session.SocksSession(SERVER_NAME, clientId);
  socksSession.onForwardingSocketRequired((host: string, port: number) => {
    const forwardingSocket = new freedom_socket.FreedomForwardingSocket();
    // TODO: destroy the socket on disconnect
    return forwardingSocket.connect(host, port).then(() => {
      return forwardingSocket;
    });
  });
  return socksSession;
}).listen().catch((e: Error) => {
  log.error('failed to start SOCKS server: %1', e.message);
}).then(() => {
  log.info('curl -x socks5h://%1:%2 www.example.com', SERVER_ADDRESS, SERVER_PORT);
});
