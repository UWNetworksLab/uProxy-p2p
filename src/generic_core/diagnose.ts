/// <reference path='../../../../../third_party/freedom-typings/freedom-core-env.d.ts' />
/// <reference path='../../../../../third_party/freedom-typings/udp-socket.d.ts' />

import arraybuffers = require('../../../third_party/uproxy-lib/arraybuffers/arraybuffers');
import logging = require('../../../third_party/uproxy-lib/logging/logging');
import messages = require('./messages');

// Both Ping and NAT type detection need help from a server. The following
// ip/port is the instance we run on EC2.
var TEST_SERVER = '54.68.73.184';
var TEST_PORT = 6666;

var log :logging.Log = new logging.Log('Diagnose');

export function doUdpTest() {
  log.info('perform udp test');
  var socket: freedom_UdpSocket.Socket = freedom['core.udpsocket']();

  function onUdpData(info: freedom_UdpSocket.RecvFromInfo) {
    var rspStr = ArrayBuffers.arrayBufferToString(info.data);
    log.debug(rspStr);

    var rsp = JSON.parse(rspStr);
    if (rsp['answer'] == 'Pong') {
      print('Pong resonse received, latency=' +
            (Date.now() - rsp['ping_time']) + 'ms')
    }
  }

  socket.bind('0.0.0.0', 0)
      .then((result: number) => {
        if (result != 0) {
          return Promise.reject(new Error('listen failed to bind :5758' +
              ' with result code ' + result));
        }
        return Promise.resolve(result);
      })
      .then(socket.getInfo)
      .then((socketInfo: freedom_UdpSocket.SocketInfo) => {
        log.debug('listening on %1:%2',
                  [socketInfo.localAddress, socketInfo.localPort]);
      })
      .then(() => {
        socket.on('onData', onUdpData);
        var pingReq = new Uint32Array(1);
        var reqStr = JSON.stringify({
          'ask': 'Ping',
          'ping_time': Date.now()
        });
        var req = ArrayBuffers.stringToArrayBuffer(reqStr);
        socket.sendTo(req, TEST_SERVER, TEST_PORT);
      });
}

var stunServers = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
  'stun:stun2.l.google.com:19302',
  'stun:stun3.l.google.com:19302',
  'stun:stun4.l.google.com:19302',
];

function doStunAccessTest() {
  log.info('perform Stun access test');
  for (var i = 0; i < stunServers.length; i++) {
    var promises : Promise<number>[] = [];
    for (var j = 0; j < 5; j++) {
      promises.push(pingStunServer(stunServers[i]));
    }
    Promise.all(promises).then((laterncies: Array<number>) => {
      var server = stunServers[i];
      var total = 0;
      for (var k = 0; k < laterncies.length; k++) {
        total += laterncies[k];
      }
      print('Average laterncy for ' + stunServers[i] +
            ' = ' + total / laterncies.length);
    });
  }
}

function pingStunServer(serverAddr: string) {
  return new Promise<number>( (F, R) => {
    var socket:freedom_UdpSocket.Socket = freedom['core.udpsocket']();
    var parts = serverAddr.split(':');
    var start = Date.now();

    var bindRequest: Turn.StunMessage = {
      method: Turn.MessageMethod.BIND,
      clazz:  Turn.MessageClass.REQUEST,
      transactionId: new Uint8Array(12),
      attributes: []
    };

    var uint16View = new Uint16Array(bindRequest.transactionId);
    for (var i = 0; i < 6; i++) {
      uint16View[i] = Math.floor(Math.random() * 65535);
    }

    socket.on('onData', (info: freedom_UdpSocket.RecvFromInfo) => {
      try {
        var response = Turn.parseStunMessage(new Uint8Array(info.data));
      } catch (e) {
        log.error('Failed to parse bind request from %1', [serverAddr]);
        R(e);
        return;
      }
      var attribute = Turn.findFirstAttributeWithType(
          Turn.MessageAttribute.XOR_MAPPED_ADDRESS, response.attributes);
      var endPoint = Turn.parseXorMappedAddressAttribute(attribute.value);
      var laterncy = Date.now() - start;
      print(serverAddr + ' returned in ' + laterncy + 'ms. ' +
            'report reflexive address: ' + JSON.stringify(endPoint));
      F(laterncy);
    });

    var bytes = Turn.formatStunMessage(bindRequest);
    socket.bind('0.0.0.0', 0)
        .then((result: number) => {
          if (result != 0) {
            return Promise.reject(new Error('listen failed to bind :5758' +
                ' with result code ' + result));
          }
          return Promise.resolve(result);
        }).then(() => {
          return socket.sendTo(bytes.buffer, parts[1], parseInt(parts[2]));
        }).then((written: number) => {
            log.debug('%1 bytes sent correctly', [written]);
        }).catch((e: Error) => {
            log.debug(JSON.stringify(e));
            R(e);
        })
  });
}

// The following code needs the help from a server to do its job. The server
// code can be found jsonserv.py in the same repository. One instance is
// running in EC2.
export function doNatProvoking() : Promise<string> {
  return new Promise((F, R) => {
    log.info('perform NAT provoking');
    var socket: freedom_UdpSocket.Socket = freedom['core.udpsocket']();
    var timerId: number = -1;

    var rejectShortcut: (e: any) => void = null;

    function onUdpData(info: freedom_UdpSocket.RecvFromInfo) {
      var rspStr: string = ArrayBuffers.arrayBufferToString(info.data);
      log.debug('receive response = ' + rspStr);

      var rsp = JSON.parse(rspStr);

      if (rsp['answer'] == 'FullCone') {
        F('FullCone');
      } else if (rsp['answer'] == 'RestrictedConePrepare') {
        var peer_addr: string[] = rsp['prepare_peer'].split(':');
        var req: ArrayBuffer = ArrayBuffers.stringToArrayBuffer('{"ask":""}');
        log.debug('reply to RestrictedConePrepare');
        socket.sendTo(req, peer_addr[0], parseInt(peer_addr[1]));
        return;
      } else if (rsp['answer'] == 'RestrictedCone') {
        F('RestrictedCone');
      } else if (rsp['answer'] == 'PortRestrictedConePrepare') {
        var peer_addr: string[] = rsp['prepare_peer'].split(':');
        var req: ArrayBuffer = ArrayBuffers.stringToArrayBuffer('{"ask":""}');
        log.debug('reply to PortRestrictedConePrepare');
        socket.sendTo(req, peer_addr[0], parseInt(peer_addr[1]));
        return;
      } else if (rsp['answer'] == 'PortRestrictedCone') {
        F('PortRestrictedCone');
      } else if (rsp['answer'] == 'SymmetricNATPrepare') {
        var peer_addr: string[] = rsp['prepare_peer'].split(':');
        var reqStr: string = JSON.stringify({ 'ask': 'AmISymmetricNAT' });
        var req: ArrayBuffer = ArrayBuffers.stringToArrayBuffer(reqStr);
        socket.sendTo(req, peer_addr[0], parseInt(peer_addr[1]));
        return;
      } else if (rsp['answer'] == 'SymmetricNAT') {
        F('SymmetricNAT');
      } else {
        return;
      }

      if (timerId != -1) {
        clearTimeout(timerId);
        if (rejectShortcut) {
          rejectShortcut(new Error('shortCircuit'));
        }
      }
    }

    socket.on('onData', onUdpData);

    socket.bind('0.0.0.0', 0)
        .then((result: number) => {
          if (result != 0) {
            return Promise.reject(new Error('failed to bind to a port: err=' + result));
          }
          return Promise.resolve(result);
        })
        .then(socket.getInfo)
        .then((socketInfo: freedom_UdpSocket.SocketInfo) => {
          log.debug('listening on %1:%2',
                    [socketInfo.localAddress, socketInfo.localPort]);
        })
        .then(() => {
          var reqStr: string = JSON.stringify({ 'ask': 'AmIFullCone' });
          log.debug('send ' + reqStr);
          var req: ArrayBuffer = ArrayBuffers.stringToArrayBuffer(reqStr);
          for (var i = 0; i < 10; i++) {
            socket.sendTo(req, TEST_SERVER, TEST_PORT);
          }
        })
        .then(() => {
          return new Promise<void>((F, R) => {
            rejectShortcut = R;
            timerId = setTimeout(() => {
              timerId = -1;
              F();
            }, 2000);
          });
        })
        .then(() => {
          var reqStr: string = JSON.stringify({ 'ask': 'AmIRestrictedCone' });
          log.debug(reqStr);
          var req: ArrayBuffer = ArrayBuffers.stringToArrayBuffer(reqStr);
          for (var i = 0; i < 3; i++) {
            socket.sendTo(req, TEST_SERVER, TEST_PORT);
          }
        })
        .then(() => {
          return new Promise<void>((F, R) => {
            rejectShortcut = R;
            timerId = setTimeout(() => {
              timerId = -1;
              F();
            }, 3000);
          });
        })
        .then(() => {
          var reqStr: string = JSON.stringify({ 'ask': 'AmIPortRestrictedCone' });
          log.debug(reqStr);
          var req: ArrayBuffer = ArrayBuffers.stringToArrayBuffer(reqStr);
          for (var i = 0; i < 3; i++) {
            socket.sendTo(req, TEST_SERVER, TEST_PORT);
          }
        })
        .then(() => {
          return new Promise<void>((F, R) => {
            rejectShortcut = R;
            timerId = setTimeout(() => {
              timerId = -1;
              F();
            }, 10000);
          });
        })
        .then(() => {
          var reqStr: string = JSON.stringify({ 'ask': 'AmISymmetricNAT' });
          log.debug(reqStr);
          var req: ArrayBuffer = ArrayBuffers.stringToArrayBuffer(reqStr);
          for (var i = 0; i < 3; i++) {
            socket.sendTo(req, TEST_SERVER, TEST_PORT);
          }
        })
        .then(() => {
          return new Promise<void>((F, R) => {
            rejectShortcut = R;
            timerId = setTimeout(() => {
              timerId = -1;
              F();
            }, 3000);
          });
        })
        .catch((e: Error) => {
          if (e.message != 'shortCircuit') {
            log.error('something wrong: ' + e.message);
            R(e);
          } else {
            log.debug('shortCircuit');
          }
        });
  });
}
