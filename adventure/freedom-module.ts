/// <reference path='../../../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../../third_party/typings/freedom/freedom-module-env.d.ts' />

import arraybuffers = require('../arraybuffers/arraybuffers');
import bridge = require('../bridge/bridge');
import logging = require('../logging/logging');
import loggingTypes = require('../loggingprovider/loggingprovider.types');
import net = require('../net/net.types');
import rtc_to_net = require('../rtc-to-net/rtc-to-net');
import socks_to_rtc = require('../socks-to-rtc/socks-to-rtc');
import tcp = require('../net/tcp');

var loggingController = freedom['loggingcontroller']();
loggingController.setDefaultFilter(
    loggingTypes.Destination.console,
    loggingTypes.Level.info);

var log :logging.Log = new logging.Log('adventure');

var pcConfig :freedom.RTCPeerConnection.RTCConfiguration = {
  iceServers: [{urls: ['stun:stun.l.google.com:19302']},
               {urls: ['stun:stun1.l.google.com:19302']},
               {urls: ['stun:stun.services.mozilla.com']}]
};

// The SOCKS server will start on this address.
// If you specify port zero then a dynamic port will be chosen
// and a single adventure instance can instantiate multiple
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
  connection.send(arraybuffers.stringToArrayBuffer(message + '\n'));
}

// Rough lifecycle is to process single word commands such as "ping" until
// "get" or "give" is received, at which point the connection is handed off
// to a SocksTotc or RtcToNet instance (and further input is treated as
// signalling channel messages).
function serveConnection(connection: tcp.Connection): void {
  var recvBuffer :ArrayBuffer = new ArrayBuffer(0);

  var processCommands = (buffer: ArrayBuffer) : void => {
    recvBuffer=arraybuffers.concat([recvBuffer, buffer]);
    var index = arraybuffers.indexOf(recvBuffer, arraybuffers.decodeByte(
      arraybuffers.stringToArrayBuffer('\n')
    ));
    if (index == -1) {
      connection.dataFromSocketQueue.setSyncNextHandler(processCommands);
    } else {
      var parts = arraybuffers.split(recvBuffer, index);
      var line = parts[0];
      recvBuffer = parts[1];

      // ''.split(' ') == ['']
      var verb = arraybuffers.arrayBufferToString(
          line).split(' ')[0].trim().toLowerCase();
      switch (verb) {
        case 'get':
          get(connection);
          break;
        case 'give':
          give(connection);
          break;
        case 'ping':
          sendReply('ping', connection);
          connection.dataFromSocketQueue.setSyncNextHandler(processCommands);
          break;
        case 'xyzzy':
          sendReply('Nothing happens.', connection);
          connection.dataFromSocketQueue.setSyncNextHandler(processCommands);
          break;
        case 'quit':
          connection.close();
          break;
        default:
          if (verb.length > 0) {
            sendReply('I don\'t understand that command. (' + verb + ')', connection);
          }
          connection.dataFromSocketQueue.setSyncNextHandler(processCommands);
      }
    }
  }
  connection.dataFromSocketQueue.setSyncNextHandler(processCommands);
}

// Creates a SocksToRtc instance and forwards signals between it and the
// connection.
function get(connection:tcp.Connection) : void {
  var socksToRtc = new socks_to_rtc.SocksToRtc();

  // Must do this before calling start.
  socksToRtc.on('signalForPeer', (signal:Object) => {
    sendReply(JSON.stringify(signal), connection);
  });

  socksToRtc.start(new tcp.Server(socksEndpoint),
      bridge.best('sockstortc', pcConfig)).then(
      (endpoint:net.Endpoint) => {
    log.info('SocksToRtc listening on %1', endpoint);
    log.info('curl -x socks5h://%1:%2 www.example.com',
        endpoint.address, endpoint.port);
    connection.close();
  }, (e:Error) => {
    log.error('failed to start SocksToRtc: %1', e.message);
    connection.close();
  });

  connection.dataFromSocketQueue.setSyncHandler((buffer:ArrayBuffer): void => {
    var signals = arraybuffers.arrayBufferToString(buffer).split('\n');
    for (var i = 0; i < signals.length; i++) {
      var signal = signals[i];
      try {
        // log.debug('signal for sockstortc: %1', signal);
        socksToRtc.handleSignalFromPeer(JSON.parse(signal));
      } catch (e) {
        log.warn('could not parse signal: %1', signal);
      }
    }
  });
}

// Creates an RtcToNet instance and forwards signals between it and the
// connection.
function give(connection:tcp.Connection) : void {
  var rtcToNet = new rtc_to_net.RtcToNet();

  rtcToNet.start({
    allowNonUnicast: true
  }, bridge.best('rtctonet', pcConfig)).then(() => {
    log.info('RtcToNet connected');
    connection.close();
  }, (e: Error) => {
    log.error('failed to start rtcToNet: %1', e.message);
    connection.close();
  });

  // Must do this after calling start.
  rtcToNet.signalsForPeer.setSyncHandler((signal:Object) => {
    sendReply(JSON.stringify(signal), connection);
  });

  connection.dataFromSocketQueue.setSyncHandler((buffer:ArrayBuffer): void => {
    var signals = arraybuffers.arrayBufferToString(buffer).split('\n');
    for (var i = 0; i < signals.length; i++) {
      var signal = signals[i];
      try {
        rtcToNet.handleSignalFromPeer(JSON.parse(signal));
      } catch (e) {
        log.warn('could not parse signal: .%1.', signal);
      }
    }
  });
}

// Start the command server and configure it to pass each client
// connection to serveConnection.
bind().then((server:tcp.Server) => {
  server.connectionsQueue.setSyncHandler((connection: tcp.Connection) => {
    connection.onceConnected.then((endpoint: tcp.ConnectionInfo) => {
      log.info('now serving client at %1', endpoint.remote);
      serveConnection(connection);
    });
  });
}, (e:Error) => {
  log.error('failed to create server: %1', e.message);
});
