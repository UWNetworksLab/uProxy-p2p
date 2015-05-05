// For testing just the TCP server portion (see src/client/tcp.ts)

import arraybuffers = require('../arraybuffers/arraybuffers');
import net = require('../net/net.types');
import tcp = require('../net/tcp');

import logging = require('../logging/logging');
var log :logging.Log = new logging.Log('echo-server');

class TcpEchoServer {
  public server :tcp.Server;

  // '4' is the char-code for control-D which we use to close the TCP
  // connection.
  public static CTRL_D_HEX_STR_CODE = '4'

  constructor(public endpoint:net.Endpoint) {
    this.server = new tcp.Server(endpoint);

    // Start listening to connections.
    this.server.listen().then((listeningEndpoint) => {
      log.info('listening on %1', listeningEndpoint);
      this.server.onceShutdown().then((kind:tcp.SocketCloseKind) => {
        log.info('server shutdown: %1', tcp.SocketCloseKind[kind]);
      });
    }).catch((e:Error) => {
      log.error('failed to listen on %1: %2', endpoint, e.toString);
    });

    // Handle any new connections using |this.onConnection_|.
    this.server.connectionsQueue.setSyncHandler(this.onConnection_);
  }

  private onConnection_ = (conn:tcp.Connection) : void => {
    log.info(conn.toString() + ': New TCP Connection: ');
    // The onceConnected is fulfilled by onConnection (in practice, but not
    // specified by the freedom TCP interface)
    conn.onceConnected.then((endpoint) => {
      log.info(conn.toString() + ': Connection resolved to: ' + JSON.stringify(endpoint));
    });
    // This use of |receiveNext| here is to shows you can how to use it to get
    // the first ArrayBuffer of data and treat handling it differently.
    conn.receiveNext().then((data :ArrayBuffer) => {
      log.info(conn.toString() + ': Received first data!');
      this.onData_(conn, data);
      // Now handle further data as we get it using |this.onData_|.
      conn.dataFromSocketQueue.setSyncHandler(this.onData_.bind(this, conn));
    });
  }

  private onData_ = (conn:tcp.Connection, data :ArrayBuffer) : void => {
    log.info(conn.toString() + ': Received: ' + data.byteLength + " bytes.");

    var hexStrOfData = arraybuffers.arrayBufferToHexString(data);
    log.info(conn.toString() + ': Received data as hex-string: ' + hexStrOfData);

    // This shows how you handle some data and close the connection.
    if(hexStrOfData === TcpEchoServer.CTRL_D_HEX_STR_CODE) {
      conn.close();
      return;
    }
    conn.send(data);
  }
}

export = TcpEchoServer;
