/// <reference path='../../../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../../third_party/typings/freedom/freedom-module-env.d.ts' />

import arraybuffers = require('../arraybuffers/arraybuffers');
import bridge = require('../bridge/bridge');
import churn_types = require('../churn/churn.types');
import logging = require('../logging/logging');
import loggingTypes = require('../loggingprovider/loggingprovider.types');
import net = require('../net/net.types');
import linefeeder = require('../net/linefeeder');
import queue = require('../handler/queue');
import rtc_to_net = require('../rtc-to-net/rtc-to-net');
import socks_to_rtc = require('../socks-to-rtc/socks-to-rtc');
import tcp = require('../net/tcp');

var loggingController = freedom['loggingcontroller']();
loggingController.setDefaultFilter(
    loggingTypes.Destination.console,
    loggingTypes.Level.info);

var log :logging.Log = new logging.Log('zork');

var pcConfig :freedom.RTCPeerConnection.RTCConfiguration = {
  iceServers: [{urls: ['stun:stun.l.google.com:19302']},
               {urls: ['stun:stun1.l.google.com:19302']},
               {urls: ['stun:stun.services.mozilla.com']}]
};

// The SOCKS server will start on this address.
// If you specify port zero then a dynamic port will be chosen
// and a single zork instance can instantiate multiple
// SOCKS servers.
var socksEndpoint :net.Endpoint = {
  address: '0.0.0.0',
  port: 9999
};

// The command port will start on the first free port listed here.
// Specifiying multiple ports allows multiple instances of this app to
// run on the same machine.
var PORTS = [9000, 9010, 9020];

// Starts a TCP server on the first free port listed in PORTS.
// Rejects if no port is free.
function bind(i:number = 0) : Promise<tcp.Server> {
  if (i >= PORTS.length) {
    return Promise.reject('no free ports');
  }
  var server = new tcp.Server({
    address: '0.0.0.0',
    port: PORTS[i]
  });
  return server.listen().then(() => {
    // TODO: There's no way to interrogate the endpoint after calling
    //       listen() so we're forced to log it here.
    log.info('listening on port %1', PORTS[i]);
    return server;
  }, (e:Error) => {
    log.debug('failed to listen on port %1 (%2)', PORTS[i], e.message);
    return bind(i + 1);
  })
}

// Sends a reply to the client, appending a newline.
var sendReply = (message:string, connection:tcp.Connection) : void => {
  log.debug('%1: sending reply: %2', connection.connectionId, message);
  connection.send(arraybuffers.stringToArrayBuffer(message + '\n'));
}

// Rough lifecycle is to process single word commands such as "ping" until
// "get" or "give" is received, at which point the connection is handed off
// to a SocksTotc or RtcToNet instance (and further input is treated as
// signalling channel messages).
function serveConnection(connection: tcp.Connection): void {
  var transformerName: string;
  var transformerConfig: string;

  const lineFeeder = new linefeeder.LineFeeder(connection.dataFromSocketQueue);
  var doit = (command: string) => {
    log.debug('%1: received command: %2', connection.connectionId, command);

    let keepParsing = false;
    var words = command.split(' ');
    var verb = words[0].trim().toLowerCase();
    switch (verb) {
      case 'get':
        get(lineFeeder, connection, (transformerName || transformerConfig) ? {
          name: transformerName,
          config: transformerConfig
        } : undefined);
        break;
      case 'give':
        give(lineFeeder, connection);
        break;
      case 'ping':
        sendReply('ping', connection);
        keepParsing = true;
        break;
      case 'transform':
        // Sample commands:
        //  * transform with caesar
        //    Uses Caesar cipher, with default/example settings.
        //  * transform config {"key": 5}
        //    Overrides the default transformer config. Everything
        //    following 'transform config' is treated as JSON and
        //    forwarded to the obfuscator's configure() method.
        if (words.length > 2) {
          var preposition = words[1].trim().toLowerCase();
          switch (preposition) {
            case 'with':
              transformerName = words[2].trim();
              break;
            case 'config':
              // Treat everything to the right of this marker as JSON.
              // Cheapo approach but it requires no escaping from the user.
              const marker = ' config ';
              transformerConfig = command.substring(
                  command.toLowerCase().indexOf(marker) + marker.length);
              break;
            default:
              sendReply('usage: transform (with name|config json)', connection);
          }
        } else {
          sendReply('usage: transform (with name|config json)', connection);
        }
        keepParsing = true;
        break;
      case 'xyzzy':
        sendReply('Nothing happens.', connection);
        keepParsing = true;
        break;
      case 'quit':
        connection.close();
        break;
      default:
        if (verb.length > 0) {
          sendReply('I don\'t understand that command. (' + verb + ')', connection);
        }
        keepParsing = true;
    }

    if (keepParsing) {
      lineFeeder.setSyncNextHandler(doit);
    }
  };
  lineFeeder.setSyncNextHandler(doit);

  connection.onceClosed.then((kind:tcp.SocketCloseKind) => {
    log.info('%1: closed (%2)',
      connection.connectionId, tcp.SocketCloseKind[kind]);
  });
}

// Creates a SocksToRtc instance and forwards signals between it and the
// connection.
function get(
    lines:queue.QueueHandler<string, void>,
    connection:tcp.Connection,
    transformerConfig:churn_types.TransformerConfig)
    :void {
  var socksToRtc = new socks_to_rtc.SocksToRtc();

  // Must do this before calling start.
  socksToRtc.on('signalForPeer', (signal:Object) => {
    sendReply(JSON.stringify(signal), connection);
  });

  socksToRtc.start(new tcp.Server(socksEndpoint), bridge.best('sockstortc',
      pcConfig, undefined, transformerConfig)).then((endpoint:net.Endpoint) => {
    log.info('%1: SOCKS server listening on %2 (curl -x socks5h://%3:%4 www.example.com)',
        connection.connectionId, endpoint,endpoint.address, endpoint.port);
    connection.close();
  }, (e:Error) => {
    log.error('%1: failed to start SOCKS server: %2',
        connection.connectionId, e.message);
    connection.close();
  });

  lines.setSyncHandler((signal:string): void => {
    log.debug('%1: received signalling message: %2',
      connection.connectionId, signal);
    try {
      socksToRtc.handleSignalFromPeer(JSON.parse(signal));
    } catch (e) {
      log.warn('%1: could not parse signal (%2): %3',
          connection.connectionId, signal, e.message);
    }
  });
}

// Creates an RtcToNet instance and forwards signals between it and the
// connection.
function give(
    lines: queue.QueueHandler<string, void>,
    connection: tcp.Connection)
    :void {
  var rtcToNet = new rtc_to_net.RtcToNet();

  rtcToNet.start({
    allowNonUnicast: true
  }, bridge.best('rtctonet', pcConfig)).then(() => {
    log.info('RtcToNet connected');
    connection.close();
  }, (e: Error) => {
    log.error('%1: failed to start rtcToNet: %1',
        connection.connectionId, e.message);
    connection.close();
  });

  // Must do this after calling start.
  rtcToNet.signalsForPeer.setSyncHandler((signal:Object) => {
    sendReply(JSON.stringify(signal), connection);
  });

  lines.setSyncHandler((signal: string): void => {
    log.debug('%1: received signalling message: %2',
      connection.connectionId, signal);
    try {
      rtcToNet.handleSignalFromPeer(JSON.parse(signal));
    } catch (e) {
      log.warn('%1: could not parse signal (%2): %3',
          connection.connectionId, signal, e.message);
    }
  });
}

// Start the command server and configure it to pass each client
// connection to serveConnection.
bind().then((server:tcp.Server) => {
  server.connectionsQueue.setSyncHandler((connection: tcp.Connection) => {
    connection.onceConnected.then((endpoint: tcp.ConnectionInfo) => {
      log.info('%1: new client from %2',
          connection.connectionId, endpoint.remote);
      serveConnection(connection);
    });
  });
}, (e:Error) => {
  log.error('failed to create server: %1', e.message);
});
