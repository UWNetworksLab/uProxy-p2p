import * as node_server from '../node/server';
import * as node_socket from '../node/socket';
import * as session from '../session';

const SERVER_ADDRESS = '0.0.0.0';
const SERVER_PORT = 9999;

// TODO: command-line args, e.g. port

new node_server.NodeSocksServer(SERVER_ADDRESS, SERVER_PORT).onConnection((clientId) => {
  return new session.SocksSession(clientId).onForwardingSocketRequired((host, port) => {
    const forwardingSocket = new node_socket.NodeForwardingSocket();
    return forwardingSocket.connect(host, port).then(() => {
      return forwardingSocket;
    });
  });
}).listen().then(() => {
  console.log('curl -x socks5h://' + SERVER_ADDRESS + ':' + SERVER_PORT + ' www.example.com');
}, (e) => {
  console.error('failed to start SOCKS server', e);
});
