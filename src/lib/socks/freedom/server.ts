import * as logging from '../../logging/logging';
import * as piece from '../piece';
import * as socks_server from '../server';

declare const freedom: freedom.FreedomInModuleEnv;

const log: logging.Log = new logging.Log('freedom socks server');

export class FreedomSocksServer implements socks_server.SocksServer {
  // Number of instances created, for logging purposes.
  private static id = 0;

  private serverSocket: freedom.TcpSocket.Socket = freedom['core.tcpsocket']();

  // Number of sessions created, for logging.
  private numSessions_ = 0;

  constructor(
    private requestedAddress: string,
    private requestedPort: number,
    private name: string = 'unnamed-socks-server-' + FreedomSocksServer.id) {
    FreedomSocksServer.id++;
  }

  private getSocksSession: () => piece.SocksPiece;

  public onConnection = (callback: () => piece.SocksPiece) => {
    this.getSocksSession = callback;
    return this;
  }

  public listen = () => {
    return this.serverSocket.listen(this.requestedAddress, this.requestedPort).then(() => {
      this.serverSocket.on('onConnection', (connectInfo) => {
        const clientId = connectInfo.host + ':' + connectInfo.port;
        log.info('%1: new SOCKS client %2', this.name, clientId);

        const socksSession = this.getSocksSession();
        const clientSocket = freedom['core.tcpsocket'](connectInfo.socket);

        // The SOCKS session has something it wants to send to the SOCKS client.
        // This is always data from the forwarding socket *except* while we're
        // establishing the SOCKS session, in which case it's some type of
        // SOCKS headers.
        socksSession.onDataForSocksClient((buffer) => {
          clientSocket.write(buffer);
        });

        // The SOCKS session is *done*. This is either because the forwarding
        // socket has disconnected or SOCKS protocol negotiation failed.
        socksSession.onDisconnect(() => {
          log.debug('%1: forwarding socket for SOCKS client %2 has disconnected', this.name, clientId);
        });

        // We received some data from the SOCKS client.
        // Whatever it is, we need to forward it to the SOCKS session.
        clientSocket.on('onData', (info) => {
          socksSession.handleDataFromSocksClient(info.data);
        });

        // The SOCKS client has disconnected. Notify the SOCKS session
        // so it perform cleanup, such as disconnecting the forwarding socket.
        clientSocket.on('onDisconnect', (info) => {
          log.info('%1: disconnected from SOCKS client %2 (%3)', this.name, clientId, info);
          // TODO: use counter to guard against early onDisconnect notifications
          freedom['core.tcpsocket'].close(clientSocket);
          socksSession.handleDisconnect();
        });
      });
    });
  }
}
