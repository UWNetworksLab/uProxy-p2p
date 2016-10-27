import * as piece from './piece';

export interface SocksServer {
  // callback is invoked each time a new client connects to the server.
  // Should be called before listen().
  onConnection(callback: (clientId: string) => piece.SocksPiece): SocksServer;

  // Resolves once the server is listening for new connections.
  listen(): Promise<void>;
}
