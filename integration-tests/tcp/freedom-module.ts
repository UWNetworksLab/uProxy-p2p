/// <reference path='../../../../third_party/typings/freedom/freedom-module-env.d.ts' />

import arraybuffers = require('../../arraybuffers/arraybuffers');
import tcp = require('../../net/tcp');
import net = require('../../net/net.types');

import logging = require('../../logging/logging');
import loggingTypes = require('../../loggingprovider/loggingprovider.types');

export var loggingController = freedom['loggingcontroller']();
loggingController.setDefaultFilter(loggingTypes.Destination.console,
                                   loggingTypes.Level.debug);

export var moduleName = 'integration-tests/tcp';
export var log :logging.Log = new logging.Log(moduleName);


var getServerOnFreePort = () : tcp.Server => {
  return new tcp.Server({
    address: '127.0.0.1',
    port: 0
  });
}

export var parentModule = freedom();

// Starts an echo server on a free port and sends some data to the server,
// verifying that an echo is received.
parentModule.on('listen', () => {
  var server = getServerOnFreePort();
  server.connectionsQueue.setSyncHandler((tcpConnection:tcp.Connection) => {
    log.info('New TCP connection: ' + tcpConnection.toString());
    tcpConnection.dataFromSocketQueue.setSyncHandler((buffer:ArrayBuffer) => {
      tcpConnection.send(buffer);
    });
  });

  server.listen().then((endpoint:net.Endpoint) => {
    var client = new tcp.Connection({endpoint: endpoint});
    client.dataFromSocketQueue.setSyncNextHandler((buffer:ArrayBuffer) => {
      var s = arraybuffers.arrayBufferToString(buffer);
      if (s == 'ping') {
        parentModule.emit('listen');
      }
    });
    client.onceConnected.then((info:tcp.ConnectionInfo) => {
      client.send(arraybuffers.stringToArrayBuffer('ping'));
    });
  });
});

// Starts a server on a free port and makes a connection to that
// port before shutting down the server, verifying that onceShutdown
// fulfills.
parentModule.on('shutdown', () => {
  var server = getServerOnFreePort();

  server.listen().then((endpoint:net.Endpoint) => {
    var client = new tcp.Connection({endpoint: endpoint});
    server.connectionsQueue.setSyncHandler((connection:tcp.Connection) => {
      client.onceConnected.then(() => {
        server.shutdown();
        return Promise.all<any>([connection.onceClosed, client.onceClosed,
            server.onceShutdown()]);
      })
      .then((values:any) => {
        parentModule.emit('shutdown');
      });
    });
  });
});

// Starts a server on a free port and makes a connection to that
// port before closing that connection, verifying that each side
// of the socket receives the appropriate SocketCloseKind event.
parentModule.on('onceclosedbyserver', () => {
  var server = getServerOnFreePort();

  server.listen().then((endpoint:net.Endpoint) => {
    var client = new tcp.Connection({endpoint: endpoint});
    server.connectionsQueue.setSyncHandler((connection:tcp.Connection) => {
      client.onceConnected.then(() => {
        connection.close();
        return Promise.all<any>([connection.onceClosed, client.onceClosed]);
      })
      .then((values:any) => {
        if (values[0] === tcp.SocketCloseKind.WE_CLOSED_IT &&
            values[1] === tcp.SocketCloseKind.REMOTELY_CLOSED) {
          parentModule.emit('onceclosedbyserver');
        }
      });
    });
  });
});

// Starts a server on a free port and makes a connection to that
// port before closing that connection, verifying that each side
// of the socket receives the appropriate SocketCloseKind event.
parentModule.on('onceclosedbyclient', () => {
  var server = getServerOnFreePort();

  server.listen().then((endpoint:net.Endpoint) => {
    var client = new tcp.Connection({endpoint: endpoint});
    server.connectionsQueue.setSyncHandler((connection:tcp.Connection) => {
      client.onceConnected.then(() => {
        client.close();
        return Promise.all<any>([connection.onceClosed, client.onceClosed]);
      })
      .then((values:any) => {
        if (values[0] === tcp.SocketCloseKind.REMOTELY_CLOSED &&
            values[1] === tcp.SocketCloseKind.WE_CLOSED_IT) {
          parentModule.emit('onceclosedbyclient');
        }
      });
    });
  });
});

// Attempts to connect to an address which is not bound.
parentModule.on('neverconnected', () => {
  var client = new tcp.Connection({
    endpoint: {
      address: '127.0.0.1',
      port: 1023 // Reserved port.
    }
  });
  client.onceConnected.catch((e:Error) => {
    return client.onceClosed;
  }).then((kind:tcp.SocketCloseKind) => {
    if (kind === tcp.SocketCloseKind.NEVER_CONNECTED) {
      parentModule.emit('neverconnected');
    }
  });
});

// Starts an echo server on a free port and verifies that five echo clients
// can send and receive data from the server.
parentModule.on('multipleclients', () => {
  var server = getServerOnFreePort();

  server.connectionsQueue.setSyncHandler((tcpConnection:tcp.Connection) => {
    tcpConnection.dataFromSocketQueue.setSyncHandler((buffer:ArrayBuffer) => {
      tcpConnection.send(buffer);
    });
  });

  server.listen().then((endpoint:net.Endpoint) => {
    var addEchoClient = (i:number) : Promise<void> => {
      var fulfill :() => void;
      var client = new tcp.Connection({endpoint: endpoint});
      client.dataFromSocketQueue.setSyncNextHandler((buffer:ArrayBuffer) => {
        var bytes = new Uint8Array(buffer);
        if (bytes.length == 1 && bytes[0] == i) {
          fulfill();
        }
      });
      client.onceConnected.then((info:tcp.ConnectionInfo) => {
        var bytes = new Uint8Array([i]);
        client.send(bytes.buffer);
      });
      return new Promise<void>((F, R) => { fulfill = F; });
    };

    var promises :Promise<void>[] = [];
    for (var i = 0; i < 5; i++) {
      promises.push(addEchoClient(i));
    }
    Promise.all(promises).then((answers:any) => {
      parentModule.emit('multipleclients');
    });
  });
});

// Starts an echo server on a free port and verifies that its connectionsCount
// is correct once five clients have connected to it.
parentModule.on('connectionscount', () => {
  var server = getServerOnFreePort();

  server.listen().then((endpoint:net.Endpoint) => {
    var clients :tcp.Connection[] = [];
    for (var i = 0; i < 5; i++) {
      clients.push(new tcp.Connection({endpoint: endpoint}));
    }

    Promise.all(clients.map((client:tcp.Connection) => {
      return client.onceConnected;
    })).then((answers:any) => {
      if (server.connectionsCount() != clients.length) {
        throw new Error();
      }
    }).then(() => {
      parentModule.emit('connectionscount');
    });
  });
});
