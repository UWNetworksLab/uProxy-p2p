/// <reference path='../../../third_party/typings/browser.d.ts' />

import arraybuffers = require('../arraybuffers/arraybuffers');
import logging = require('../logging/logging');

declare const freedom: freedom.FreedomInModuleEnv;

// NAT detection needs the help of an external server.
// We keep this running on Amazon EC2 and the source
// may be found here:
//   https://github.com/uProxy/uproxy-probe/blob/master/python-src/probe-server.py
var TEST_SERVER = '52.34.126.245';
var TEST_PORT = 6666;

var log :logging.Log = new logging.Log('probe');

export function probe() : Promise<string> {
  return new Promise((F, R) => {
    var socket :freedom.UdpSocket.Socket = freedom['core.udpsocket']();
    // The weird-looking type is due to a DefinitelyTyped weirdness
    // mentioned here:
    //   https://github.com/Microsoft/TypeScript/issues/842
    var timerId :NodeJS.Timer = undefined;

    var rejectShortcut: (e: any) => void = null;

    function onUdpData(info: freedom.UdpSocket.RecvFromInfo) {
      var rspStr: string = arraybuffers.arrayBufferToString(info.data);
      log.debug('receive response = ' + rspStr);

      var rsp = JSON.parse(rspStr);

      if (rsp['answer'] === 'FullCone') {
        F('FullCone');
      } else if (rsp['answer'] === 'RestrictedConePrepare') {
        var peer_addr: string[] = rsp['prepare_peer'].split(':');
        var req: ArrayBuffer = arraybuffers.stringToArrayBuffer('{"ask":""}');
        log.debug('reply to RestrictedConePrepare');
        socket.sendTo(req, peer_addr[0], parseInt(peer_addr[1]));
        return;
      } else if (rsp['answer'] === 'RestrictedCone') {
        F('RestrictedCone');
      } else if (rsp['answer'] === 'PortRestrictedConePrepare') {
        var peer_addr: string[] = rsp['prepare_peer'].split(':');
        var req: ArrayBuffer = arraybuffers.stringToArrayBuffer('{"ask":""}');
        log.debug('reply to PortRestrictedConePrepare');
        socket.sendTo(req, peer_addr[0], parseInt(peer_addr[1]));
        return;
      } else if (rsp['answer'] === 'PortRestrictedCone') {
        F('PortRestrictedCone');
      } else if (rsp['answer'] === 'SymmetricNATPrepare') {
        var peer_addr: string[] = rsp['prepare_peer'].split(':');
        var reqStr: string = JSON.stringify({ 'ask': 'AmISymmetricNAT' });
        var req: ArrayBuffer = arraybuffers.stringToArrayBuffer(reqStr);
        socket.sendTo(req, peer_addr[0], parseInt(peer_addr[1]));
        return;
      } else if (rsp['answer'] === 'SymmetricNAT') {
        F('SymmetricNAT');
      } else {
        return;
      }
      
      if (timerId !== undefined) {
        clearTimeout(timerId);
        if (rejectShortcut) {
          rejectShortcut(new Error('shortCircuit'));
        }
      }
    }   

    socket.on('onData', onUdpData);

    socket.bind('0.0.0.0', 0).then(socket.getInfo).then(
        (socketInfo:freedom.UdpSocket.SocketInfo) => {
      log.debug('listening on %1', socketInfo);
      var reqStr :string = JSON.stringify({ 'ask': 'AmIFullCone' });
      log.debug('send ' + reqStr);
      var req :ArrayBuffer = arraybuffers.stringToArrayBuffer(reqStr);
      for (var i = 0; i < 10; i++) {
        socket.sendTo(req, TEST_SERVER, TEST_PORT);
      }
    }).then(() => {
      return new Promise<void>((F, R) => {
        rejectShortcut = R;
        timerId = setTimeout(() => {
          timerId = undefined;
          F();
        }, 2000);
      });
    }).then(() => {
      var reqStr: string = JSON.stringify({ 'ask': 'AmIRestrictedCone' });
      log.debug(reqStr);
      var req: ArrayBuffer = arraybuffers.stringToArrayBuffer(reqStr);
      for (var i = 0; i < 3; i++) {
        socket.sendTo(req, TEST_SERVER, TEST_PORT);
      }
    }).then(() => {
      return new Promise<void>((F, R) => {
        rejectShortcut = R;
        timerId = setTimeout(() => {
          timerId = undefined;
          F();
        }, 3000);
      });
    }).then(() => {
      var reqStr: string = JSON.stringify({ 'ask': 'AmIPortRestrictedCone' });
      log.debug(reqStr);
      var req: ArrayBuffer = arraybuffers.stringToArrayBuffer(reqStr);
      for (var i = 0; i < 3; i++) {
        socket.sendTo(req, TEST_SERVER, TEST_PORT);
      }
    }).then(() => {
      return new Promise<void>((F, R) => {
        rejectShortcut = R;
        timerId = setTimeout(() => {
          timerId = undefined;
          F();
        }, 10000);
      });
    }).then(() => {
      var reqStr: string = JSON.stringify({ 'ask': 'AmISymmetricNAT' });
      log.debug(reqStr);
      var req: ArrayBuffer = arraybuffers.stringToArrayBuffer(reqStr);
      for (var i = 0; i < 3; i++) {
        socket.sendTo(req, TEST_SERVER, TEST_PORT);
      }
    }).then(() => {
      return new Promise<void>((F, R) => {
        rejectShortcut = R;
        timerId = setTimeout(() => {
          timerId = undefined;
          F();
        }, 3000);
      });
    }).catch((e: Error) => {
      if (e.message !== 'shortCircuit') {
        log.error('something wrong: ' + e.message);
        R(e);
      } else {
        log.debug('shortCircuit');
      }
    });
  });
}
