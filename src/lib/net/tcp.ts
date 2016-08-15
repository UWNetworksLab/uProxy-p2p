/// <reference path='../../../third_party/typings/index.d.ts' />

import logging = require('../logging/logging');
import handler = require('../handler/queue');
import net = require('./net.types');
import counter = require('./counter');

declare const freedom: freedom.FreedomInModuleEnv;

var log: logging.Log = new logging.Log('tcp');

// Indicates how a socket (server or client) terminated.
export enum SocketCloseKind {
  WE_CLOSED_IT,
  REMOTELY_CLOSED,
  NEVER_CONNECTED,
  UNKOWN
}

export interface ConnectionInfo {
  bound  ?:net.Endpoint;
  remote ?:net.Endpoint;
}

// Maximum per-server number of TCP connections.
var DEFAULT_MAX_CONNECTIONS = 1048576;

// Public only for unit tests.
export function endpointOfSocketInfo(info:freedom.TcpSocket.SocketInfo)
    : ConnectionInfo {
  var retval :ConnectionInfo = {};
  if (typeof info.localAddress == 'string' &&
      typeof info.localPort == 'number') {
    retval.bound = {
      address: info.localAddress,
      port: info.localPort
    };
  }
  if (typeof info.peerAddress == 'string' &&
      typeof info.peerPort == 'number') {
    retval.remote = {
      address: info.peerAddress,
      port: info.peerPort
    };
  }
  return retval;
}

// Closes a TCP socket provider's communication channel, causing freedomjs
// to "forget" about the instance, i.e.:
//   freedom['core.tcpsocket'].close
// This is different from calling close on the provider instance.
function destroyFreedomSocket_(socket:freedom.TcpSocket.Socket) : void {
  freedom['core.tcpsocket'].close(socket);
}

// Promise and handler queue-based TCP server with freedomjs sockets.
// TODO: protection against multiple calls to methods such as listen
export class Server {
  // Count of sockets created to date.
  private static numCreations_ :number = 0;

  // Unique ID, for logging purposes.
  private id_ :string;

  private socket_ :freedom.TcpSocket.Socket;

  // Tracks calls to the socket, for safe destruction.
  private counter_ :counter.Counter;

  // Active connections to the server.
  // TODO: index by connectionId rather than socketID
  private connections_ :{[socketId:number] : Connection} = {};

  public connectionsQueue :handler.Queue<Connection, void> =
      new handler.Queue<Connection, void>();

  private fulfillListening_ :(endpoint:net.Endpoint) => void;
  private rejectListening_ :(e:Error) => void;

  private onceListening_ = new Promise<net.Endpoint>((F, R) => {
    this.fulfillListening_ = F;
    this.rejectListening_ = R;
  });

  private fulfillShutdown_ :(kind:SocketCloseKind) => void;

  private onceShutdown_ = new Promise<SocketCloseKind>((F, R) => {
    this.fulfillShutdown_ = F;
  });

  constructor(private endpoint_ :net.Endpoint,
      private maxConnections_ :number = DEFAULT_MAX_CONNECTIONS) {
    this.id_ = 'S' + (Server.numCreations_++);

    this.onceListening_.catch((e:Error) => {
      this.fulfillShutdown_(SocketCloseKind.NEVER_CONNECTED);
    });

    this.socket_ = freedom['core.tcpsocket']();
    this.socket_.on('onConnection', this.onConnectionHandler_);
    this.socket_.on('onDisconnect', this.onDisconnectHandler_);

    this.counter_ = new counter.Counter(destroyFreedomSocket_.bind(
        undefined, this.socket_));
  }

  // Invoked when the socket terminates.
  private onDisconnectHandler_ = (info:freedom.TcpSocket.DisconnectInfo) : void => {
    if (info) {
      log.debug('%1: onDisconnect: %2', this.id_, info);
    } else {
      // TODO: Consider removing this check when this issue is fixed:
      //         https://github.com/freedomjs/freedom-for-firefox/issues/63
      log.warn('%1: onDisconnect without info', this.id_);
    }

    this.counter_.discard();

    this.counter_.onceDestroyed().then(() => {
      log.debug('%1: closed socket channel', this.id_);
      if (info && info.errcode === 'SUCCESS') {
        this.fulfillShutdown_(SocketCloseKind.WE_CLOSED_IT);
      } else {
        // TODO: investigate which other values occur
        this.fulfillShutdown_(SocketCloseKind.UNKOWN);
      }
    }, (e:Error) => {
      log.error('%1: error closing socket channel: %2', this.id_, e.message);
      this.fulfillShutdown_(SocketCloseKind.UNKOWN);
    });
  }

  // Listens for connections, returning onceListening.
  // Should only be called once.
  public listen = () : Promise<net.Endpoint> => {
    this.counter_.wrap(() => {
      return this.socket_.listen(this.endpoint_.address,
          this.endpoint_.port).then(() => {
        return this.socket_.getInfo();
      });
    }).then((info:freedom.TcpSocket.SocketInfo) => {
      this.endpoint_ = {
        address: info.localAddress,
        port: info.localPort
      };
      this.fulfillListening_(this.endpoint_);
    }).catch((e:Error) => {
      this.rejectListening_(new Error('failed to listen: ' + e.message));
    });

    return this.onceListening_;
  }

  // Invoked each time a new connection is established with the server.
  private onConnectionHandler_ = (
      acceptValue:freedom.TcpSocket.ConnectInfo) : void => {
    log.debug('%1: new connection', this.id_);
    var socketId = acceptValue.socket;

    if (this.connectionsCount() >= this.maxConnections_) {
      log.warn('%1: hit maximum connections count, dropping new connection',
          this.id_);
      var newConnection :freedom.TcpSocket.Socket =
          freedom['core.tcpsocket'](socketId);
      newConnection.close().then(() => {
        destroyFreedomSocket_(newConnection);
      }, (e:Error) => {
        log.error('%1: failed to close new connection socket: %2',
            this.id_, e.message);
        destroyFreedomSocket_(newConnection);
      }).catch((e:Error) => {
        log.error('%1: failed to destroy socket provider: %2',
            this.id_, e.message);
      });
      return;
    }

    var connection = new Connection({
      existingSocketId: socketId
    });
    this.connections_[socketId] = connection;

    var discard = () => {
      delete this.connections_[socketId];
      log.debug('%1: discarded connection (%2 remaining)',
          this.id_, this.connectionsCount());
    };
    connection.onceClosed.then(discard, (e:Error) => {
      log.error('%1: connection %2 rejected on close: %3',
          this.id_, socketId, e.message);
      discard();
    });

    this.connectionsQueue.handle(connection);
  }

  // Closes the server socket then closes all active connections.
  // Equivalent to calling stopListening followed by closeAll.
  public shutdown = () : Promise<void> => {
    log.debug('%1: shutdown', this.id_);
    // This order is important: make sure no new connections happen while
    // we're trying to close all the connections.
    return this.stopListening().then(this.closeAll);
  }

  // Closes the server socket, preventing any new connections.
  // Does not affect active connections to the server.
  public stopListening = () : Promise<void> => {
    log.debug('%1: closing socket, no new connections will be accepted',
        this.id_);
    return this.counter_.wrap(this.socket_.close);
  }

  // Closes all active connections.
  public closeAll = () : Promise<void> => {
    log.debug('%1: closing all connections', this.id_);

    var promises :Promise<SocketCloseKind>[] = [];
    for (var socketId in this.connections_) {
      var connection = this.connections_[socketId];
      promises.push(connection.close());
    }

    return Promise.all(promises).then((unused:any) => {});
  }

  // Returns all active connections.
  public connections = () : Connection[] => {
    var connections : Connection[] = [];
    for (var socketId in this.connections_) {
      connections.push(this.connections_[socketId]);
    }
    return connections;
  }

  // Returns the number of the active connections.
  public connectionsCount = () => {
    return Object.keys(this.connections_).length;
  }

  // Returns a promise which fulfills once the socket is accepting
  // connections and rejects if there is any error creating the socket
  // or listening for connections.
  public onceListening = () : Promise<net.Endpoint> => {
    return this.onceListening_;
  }

  // Returns a promise which fulfills once the socket has stopped
  // accepting new connections, or the call to listen has failed.
  public onceShutdown = () : Promise<SocketCloseKind> => {
    return this.onceShutdown_;
  }

  public toString = () : string => {
    return 'TCP server ' + this.id_ + ': ' + JSON.stringify(this.endpoint_) +
        ', ' + this.connectionsCount() + ' connections: ' +
        this.connections().join(', ');
  }
}

// Tcp.Connection - Manages up a single TCP connection.
export class Connection {
  // Unique identifier for each connection.
  private static globalConnectionId_ :number = 0;

  // Promise for when this connection is closed.
  public onceConnected :Promise<ConnectionInfo>;
  public onceClosed :Promise<SocketCloseKind>;
  // Queue of data to be handled, and the capacity to set a handler and
  // handle the data.
  public dataFromSocketQueue :handler.Queue<ArrayBuffer,void>;
  public dataToSocketQueue :handler.Queue<ArrayBuffer,void>;

  // Public unique connectionId.
  public connectionId :string;

  // isClosed() === state_ === Connection.State.CLOSED iff onceClosed
  // has been rejected or fulfilled. We use isClosed to ensure that we only
  // fulfill/reject the onceClosed once.
  private state_ :Connection.State;
  // The underlying Freedom TCP socket.
  private connectionSocket_ :freedom.TcpSocket.Socket;

  // Tracks calls to the socket, for safe destruction.
  private counter_ :counter.Counter;

  // A private function called to invoke fullfil onceClosed.
  private fulfillClosed_ :(reason:SocketCloseKind)=>void;

  // A TCP connection for a given socket.
  constructor(connectionKind:Connection.Kind, private startPaused_?:boolean) {
    this.connectionId = 'N' + Connection.globalConnectionId_++;

    this.dataFromSocketQueue = new handler.Queue<ArrayBuffer,void>();
    this.dataToSocketQueue = new handler.Queue<ArrayBuffer,void>();

    if(Object.keys(connectionKind).length !== 1) {
      //log.error(this.connectionId + ': Bad New Tcp Connection Kind:' +
      //       JSON.stringify(connectionKind));
      this.state_ = Connection.State.ERROR;
      this.onceConnected =
          Promise.reject(new Error(
              this.connectionId + 'Bad New Tcp Connection Kind:' +
              JSON.stringify(connectionKind)));
      this.onceClosed = Promise.resolve(SocketCloseKind.NEVER_CONNECTED);
      return;
    }

    if(connectionKind.existingSocketId) {
      // If we already have an open socket; i.e. from a previous tcp listen.
      // So we get a handler to the old freedom socket.
      this.connectionSocket_ =
          freedom['core.tcpsocket'](connectionKind.existingSocketId);
      this.counter_ = new counter.Counter(destroyFreedomSocket_.bind(
          undefined, this.connectionSocket_));
      this.onceConnected = this.counter_.wrap(
          this.connectionSocket_.getInfo).then(endpointOfSocketInfo);
      this.state_ = Connection.State.CONNECTED;
      this.connectionId = this.connectionId + '.A' +
          connectionKind.existingSocketId;
    } else if (connectionKind.endpoint) {
      // Create a new tcp socket to the given endpoint.
      this.connectionSocket_ = freedom['core.tcpsocket']();
      this.counter_ = new counter.Counter(destroyFreedomSocket_.bind(
          undefined, this.connectionSocket_));
      // We don't declare ourselves connected until we know the IP address to
      // which we have connected.  To speed this process up, we immediately
      // pause the socket as soon as it's connected, so that CPU time is not
      // wasted sending events that we can't pass on until getInfo returns.
      this.onceConnected = this.counter_.wrap(() => {
        return this.connectionSocket_
              .connect(connectionKind.endpoint.address,
                       connectionKind.endpoint.port)
              .then(this.pause)
              .then(this.connectionSocket_.getInfo)
              .then((info:freedom.TcpSocket.SocketInfo) => {
                if (!this.startPaused_) {
                  this.resume();
                }
                return endpointOfSocketInfo(info);
              });
      });
      this.state_ = Connection.State.CONNECTING;
      this.onceConnected
          .then(() => {
            // We need this guard because the getInfo call is async and a
            // close may happen affter the freedom socket connects and the
            // getInfo completes.
            if(this.state_ === Connection.State.CONNECTING) {
              this.state_ = Connection.State.CONNECTED;
            }
          });
    } else {
      throw(new Error(this.connectionId +
          ': Should be impossible connectionKind' +
          JSON.stringify(connectionKind)));
    }

    this.connectionSocket_.on('onData', this.onData_);

    this.onceClosed = new Promise<SocketCloseKind>((F, R) => {
      this.fulfillClosed_ = F;
    });

    // Once we are connected, we start sending data to the underlying socket.
    // |dataToSocketQueue| allows a class using this connection to start
    // queuing data to be send to the socket.
    this.onceConnected.then(() => {
      this.dataToSocketQueue.setSyncHandler(
          this.connectionSocket_.write.reckless);
    });
    this.onceConnected.catch((e:Error) => {
      this.fulfillClosed_(SocketCloseKind.NEVER_CONNECTED);
    });

    this.connectionSocket_.on('onDisconnect', this.onDisconnectHandler_);
  }

  // Use the dataFromSocketQueue handler for data from the socket.
  private onData_ = (readInfo:freedom.TcpSocket.ReadInfo) : void => {
    this.dataFromSocketQueue.handle(readInfo.data);
  }

  // Receive returns a promise for exactly the next |ArrayBuffer| of data.
  public receiveNext = () : Promise<ArrayBuffer> => {
    return new Promise((F,R) => {
      this.dataFromSocketQueue.setSyncNextHandler(F).catch(R);

      this.onceClosed.then((reason:SocketCloseKind) => {
        if (this.dataFromSocketQueue.getLength() === 0) {
          R(new Error('Receive aborted due to socket close (' + reason + ')'));
        }
      });
    });
  }

  // Invoked when the socket is closed for any reason.
  // Fulfills onceClosed.
  private onDisconnectHandler_ = (info:freedom.TcpSocket.DisconnectInfo) : void => {
    if (info) {
      log.debug('%1: onDisconnect: %2', this.connectionId, info);
    } else {
      log.warn('%1: onDisconnect without info', this.connectionId);
    }

    if (this.state_ === Connection.State.CLOSED) {
      log.warn('%1: Got onDisconnect in closed state', this.connectionId);
      return;
    }

    this.counter_.discard();

    this.state_ = Connection.State.CLOSED;
    this.dataToSocketQueue.stopHandling();
    this.dataToSocketQueue.clear();

    this.counter_.onceDestroyed().then(() => {
      log.debug('%1: closed socket channel', this.connectionId);
      // CONSIDER: can this happen after a onceConnected promise rejection? if so,
      // do we want to preserve the SocketCloseKind.NEVER_CONNECTED result for
      // onceClosed?
      if (info && info.errcode === 'SUCCESS') {
        this.fulfillClosed_(SocketCloseKind.WE_CLOSED_IT);
      } else if (info && info.errcode === 'CONNECTION_CLOSED') {
        this.fulfillClosed_(SocketCloseKind.REMOTELY_CLOSED);
      } else {
        this.fulfillClosed_(SocketCloseKind.UNKOWN);
      }
    }, (e:Error) => {
      log.error('%1: error closing socket channel: %2',
          this.connectionId, e.message);
    });
  }

  public pause = () => {
    this.connectionSocket_.pause.reckless();
  }

  public resume = () => {
    this.connectionSocket_.resume.reckless();
  }

  // This is called to close the underlying socket. This fulfills the
  // disconnect Promise `onceDisconnected`.
  public close = () : Promise<SocketCloseKind> => {
    log.debug('%1: close', [this.connectionId]);

    if (this.state_ === Connection.State.CLOSING ||
        this.state_ === Connection.State.CLOSED) {
      log.debug('%1: close called when already closed', [
          this.connectionId]);
    } else {
      this.state_ = Connection.State.CLOSING;

      this.dataFromSocketQueue.stopHandling();
      this.dataFromSocketQueue.clear();
      this.connectionSocket_.off('onData', this.onData_);

      this.counter_.wrap(this.connectionSocket_.close);
    }

    // The onDisconnect handler (which should only
    // be invoked once) actually stops handling, fulfills
    // onceClosed, etc.
    return this.onceClosed;
  }

  // Boolean function to check if this connection is closed;
  public isClosed = () : boolean => {
    return this.state_ === Connection.State.CLOSED;
  };
  public getState = () : Connection.State => {
    return this.state_;
  };

  /**
   * Sends a message that is pre-formatted as an arrayBuffer.
   */
  public send = (msg :ArrayBuffer) : Promise<void> => {
    // This will reject if the socket is closed before the
    // data can be sent.
    return this.dataToSocketQueue.handle(msg);
  }

  public toString = () => {
    return 'Tcp.Connection(' + this.connectionId + ':' + Connection.State[this.state_] + ')';
  }

}  // class Tcp.Connection

// Static stuff for the Connection class.
export module Connection {
  // Exactly one of the arguments must be specified.
  export interface Kind {
    // To wrap up a connection for an existing socket
    existingSocketId ?:number;
    // TO create a new TCP connection to this target address and port.
    endpoint         ?:net.Endpoint;
  }

  // Describes the state of a connection.
  export enum State {
    ERROR, // Cannot change state.
    CONNECTING, // Can change to ERROR or CONNECTED.
    CONNECTED, // Can change to ERROR or CLOSING/CLOSED.
    CLOSING, // Can change to CLOSED or ERROR.
    CLOSED // Cannot change state.
  }
} // module Connection
