/// <reference path='../../../third_party/typings/browser.d.ts' />

import logging = require('../logging/logging');
import loggingTypes = require('../loggingprovider/loggingprovider.types');
import net = require('../net/net.types');
import tcp = require('../net/tcp');

declare const freedom: freedom.FreedomInModuleEnv;

// Endpoint on which the server will listen.
var requestedEndpoint: net.Endpoint = {
  address: '127.0.0.1',
  port: 9998
};

// Character code for CTRL-D.
// When received, we close the connection.
var CTRL_D_CODE_HEX = '04';

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
      if (new Buffer(data).toString('hex') === CTRL_D_CODE_HEX) {
        connection.close();
      } else {
        connection.send(data);
      }
    });
  });
}).catch((e:Error) => {
  log.error('failed to listen: %2', e.message);
});
