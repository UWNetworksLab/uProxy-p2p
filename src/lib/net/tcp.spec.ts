/// <reference path='../../../../third_party/typings/browser.d.ts' />

import freedomMocker = require('../freedom/mocks/mock-freedom-in-module-env');
declare var freedom: freedom.FreedomInModuleEnv;
freedom = freedomMocker.makeMockFreedomInModuleEnv();

import tcp = require('./tcp');

describe('Tcp', function() {
  it('conversion of a connected endpoint info', () => {
    var input :freedom.TcpSocket.SocketInfo = {
      localAddress: '127.0.0.1',
      localPort: 1234,
      peerAddress: '192.0.2.111',
      peerPort: 1023,
      connected: true
    };

    var output :tcp.ConnectionInfo = {
      bound: {
        address: '127.0.0.1',
        port: 1234
      },
      remote: {
        address: '192.0.2.111',
        port: 1023
      }
    };

    expect(tcp.endpointOfSocketInfo(input)).toEqual(output);
  });

  it('conversion of a closed endpoint info', () => {
    var input :freedom.TcpSocket.SocketInfo = {
      connected: false
    };

    var output :tcp.ConnectionInfo = {};

    expect(tcp.endpointOfSocketInfo(input)).toEqual(output);
  });
});
