/// <reference path='../../../../third_party/typings/index.d.ts' />

import node_server = require('../node/server');
import node_socket = require('../node/socket');
import session = require('../session');

const SERVER_ADDRESS = '0.0.0.0';
const SERVER_PORT = 9999;

// TODO: command-line args, e.g. port

new node_server.NodeSocksServer(SERVER_ADDRESS, SERVER_PORT).onConnection((clientId) => {
  const socksSession = new session.SocksSession(clientId);
  socksSession.onForwardingSocketRequired((host, port) => {
    const forwardingSocket = new node_socket.NodeForwardingSocket();
    return forwardingSocket.connect(host, port).then(() => {
      return forwardingSocket;
    });
  });
  return socksSession;
}).listen().then(() => {
  console.log('curl -x socks5h://' + SERVER_ADDRESS + ':' + SERVER_PORT + ' www.example.com');
}, (e) => {
  console.error('failed to start SOCKS server', e);
});
