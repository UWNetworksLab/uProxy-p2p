/// <reference path='../../../third_party/typings/index.d.ts' />

import * as logging from '../logging/logging';
import * as loggingTypes from '../loggingprovider/loggingprovider.types';
import * as net from '../net/net.types';
import * as tcp from '../net/tcp';

declare const freedom: freedom.FreedomInModuleEnv;

// Endpoint on which the server will listen.
var requestedEndpoint: net.Endpoint = {
  address: '127.0.0.1',
  port: 9998
};

// Character code for CTRL-D.
// When received, we close the connection.
const CTRL_D_CODE = 4;

var loggingController = freedom['loggingcontroller']();
loggingController.setDefaultFilter(loggingTypes.Destination.console,
                                   loggingTypes.Level.debug);

var log :logging.Log = new logging.Log('echo');

var numConnections :number = 0;

var server :tcp.Server = new tcp.Server(requestedEndpoint);
server.listen().then((actualEndpoint) => {
  log.info('listening on %1', actualEndpoint);
  server.onceShutdown().then((kind:tcp.SocketCloseKind) => {
    log.info('server shutdown: %1', tcp.SocketCloseKind[kind]);
  });

  server.connectionsQueue.setSyncHandler((connection:tcp.Connection) : void => {
    var id = numConnections++;
    log.info('%1: open', id);

    connection.onceClosed.then((kind:tcp.SocketCloseKind) => {
      log.info('%1: closed (%2)', id, tcp.SocketCloseKind[kind]);
    });

    connection.dataFromSocketQueue.setSyncHandler((data:ArrayBuffer): void => {
      log.info('%1: received %2 bytes', id, data.byteLength);
      if (data.byteLength === 1 && new Uint8Array(data)[0] === CTRL_D_CODE) {
        connection.close();
      } else {
        connection.send(data);
      }
    });
  });
}).catch((e:Error) => {
  log.error('failed to listen: %2', e.message);
});
