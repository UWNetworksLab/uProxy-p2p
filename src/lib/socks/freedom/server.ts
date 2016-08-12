/// <reference path='../../../../third_party/typings/index.d.ts' />

import logging = require('../../logging/logging');
import piece = require('../piece');

declare const freedom: freedom.FreedomInModuleEnv;

const log: logging.Log = new logging.Log('freedom socks server');

export class FreedomSocksServer {
  // Number of instances created, for logging purposes.
  private static id_ = 0;

  private serverSocket: freedom.TcpSocket.Socket = freedom['core.tcpsocket']();

  // Number of sessions created, for logging.
  private numSessions_ = 0;

  constructor(
    private requestedAddress_: string,
    private requestedPort_: number,
    private name_: string = 'unnamed-socks-server-' + FreedomSocksServer.id_) {
    FreedomSocksServer.id_++;
  }

  private getSocksSession_: () => piece.SocksPiece;

  // Configures a callback which is invoked when a new SOCKS client has connected.
  public onConnection = (callback: () => piece.SocksPiece): FreedomSocksServer => {
    this.getSocksSession_ = callback;
    return this;
  }

  public listen = () => {
    return this.serverSocket.listen(this.requestedAddress_, this.requestedPort_).then(() => {
      this.serverSocket.on('onConnection', (connectInfo) => {
        const clientId = connectInfo.host + ':' + connectInfo.port;
        log.info('%1: new SOCKS client %2', this.name_, clientId);

        const clientSocket = freedom['core.tcpsocket'](connectInfo.socket);

        const socksSession = this.getSocksSession_();

        // The SOCKS session has something it wants to send to the SOCKS client.
        // This is always data from the forwarding socket *except* while we're
        // establishing the SOCKS session, in which case it's some type of
        // SOCKS headers.
        socksSession.onData((buffer) => {
          clientSocket.write(buffer);
        });

        // The SOCKS session is *done*. This is either because the forwarding
        // socket has disconnected or SOCKS protocol negotiation failed.
        socksSession.onDisconnect(() => {
          log.debug('%1: forwarding socket for SOCKS client %2 has disconnected', this.name_, clientId);
        });

        // We received some data from the SOCKS client.
        // Whatever it is, we need to forward it to the SOCKS session.
        clientSocket.on('onData', (info) => {
          socksSession.handleData(info.data);
        });

        // The SOCKS client has disconnected. Notify the SOCKS session
        // so it perform cleanup, such as disconnecting the forwarding socket.
        clientSocket.on('onDisconnect', (info) => {
          log.info('%1: disconnected from SOCKS client %2 (%3)', this.name_, clientId, info);
          // TODO: use counter to guard against early onDisconnect notifications
          freedom['core.tcpsocket'].close(clientSocket);
          socksSession.handleDisconnect();
        });
      });
    });
  }
}
