import * as net from 'net';
import * as piece from '../piece';
import * as socks_server from '../server';

export class NodeSocksServer implements socks_server.SocksServer {
  private tcpServer: net.Server;
  private getSocksSession: (clientId: string) => piece.SocksPiece;
  private numSessions = 0;

  constructor(
    private requestedAddress_: string,
    private requestedPort_: number) { }

  // Configures a callback which is invoked when a new SOCKS client has connected.
  public onConnection = (callback: (clientId: string) => piece.SocksPiece) => {
    this.getSocksSession = callback;
    return this;
  };

  public address = () => {
    return this.tcpServer.address();
  };

  public listen = () => {
    // complete list of events:
    //   https://nodejs.org/dist/latest-v4.x/docs/api/net.html#net_class_net_server
    const server = this.tcpServer = net.createServer((client) => {
      const clientId = 'p' + (this.numSessions++) + 'p';

      console.info(clientId + ': new client from ' +
        client.remoteAddress + ':' + client.remotePort);
      const session = this.getSocksSession(clientId);

      const ignoreDataForSocksClient = () => {
        console.info('now ignoring data for client socket');
        session.onDataForSocksClient((ab) => { });
      };

      // complete list of events:
      //   https://nodejs.org/dist/latest-v4.x/docs/api/net.html#net_class_net_socket

      client.on('close', (hadError: boolean) => {
        if (hadError) {
          console.error(clientId + ': client disconnected with error');
        } else {
          console.error(clientId + ': client disconnected (' + client.bytesRead + ' bytes read, ' + client.bytesWritten + ' written)');
        }

        ignoreDataForSocksClient();
        session.handleDisconnect();
      });

      session.onDataForSocksClient((ab) => {
        client.write(new Buffer(ab));
      });

      session.onDisconnect(() => {
        client.end();
      });

      // note that DATA WILL BE LOST if there is data
      // is received before this handler is set:
      //   https://nodejs.org/dist/latest-v4.x/docs/api/net.html#net_event_data
      // so...do we need to open with pause or something?
      client.on('data', (buffer: Buffer) => {
        session.handleDataFromSocksClient(buffer.buffer);
      });

      // TODO: drain listener?

      // there's some configurability here we probably
      // don't need, suspect close is waht we care about:
      //   https://nodejs.org/dist/latest-v4.x/docs/api/net.html#net_event_end
      // client.on('end', () => {
      //   console.info(clientId + ': client socket ended');
      // });

      client.on('error', (e: Error) => {
        console.error(clientId + ': client socket closed with error', e);
        ignoreDataForSocksClient();
      });

      client.on('timeout', () => {
        console.error(clientId + ': client socket timed out');
      });
    });

    server.on('error', (e: Error) => {
      // it's not clear how this happen, since there's
      // no way to tell the socks server to shutdown.
      console.error('server socket error', e);
    });

    server.on('close', () => {
      // it's not clear how this happen, since there's
      // no way to tell the socks server to shutdown,
      // but errors may be one way.
      console.info('server socket closed');
    });

    return new Promise<void>((F, R) => {
      try {
        server.listen({
          host: this.requestedAddress_,
          port: this.requestedPort_
        }, F);
      } catch (e) {
        R(e);
      }
    });
  };
}
