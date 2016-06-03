/// <reference path='../../../../../third_party/typings/browser.d.ts' />

import arraybuffers = require('../../arraybuffers/arraybuffers');
import socks = require('../../socks-common/socks-headers');

import proxyintegrationtesttypes = require('./proxy-integration-test.types');
import ProxyIntegrationTester = proxyintegrationtesttypes.ProxyIntegrationTester;
import ReceivedDataEvent = proxyintegrationtesttypes.ReceivedDataEvent;

declare const freedom: freedom.FreedomInCoreEnv;

// Integration test for the whole proxying system.
// The real work is done in the Freedom module which performs each test.
export function socksEchoTestDescription(useChurn:boolean) {
  var testStrings = [
    'foo',
    'bar',
    'longer string',
    '1',
    'that seems like enough'
  ];

  var testerFactoryManager
        :freedom.FreedomModuleFactoryManager<ProxyIntegrationTester>;
  var testModule :ProxyIntegrationTester;
  var createTestModule = function(denyLocalhost?:boolean,
      sessionLimit?:number, ipv6Only?:boolean) : ProxyIntegrationTester {
        return testerFactoryManager(denyLocalhost, useChurn, sessionLimit, ipv6Only);
  };

  beforeEach((done) => {
    freedom('files/freedom-module.json', {
      debug: 'debug'
    }).then((freedomModuleFactoryManager: any) => {
      testerFactoryManager = freedomModuleFactoryManager;
      done();
    });
  });

  afterEach(() => {
    expect(testerFactoryManager).not.toBeUndefined();
    // Close all created interfaces to the freedom module.
    testerFactoryManager.close();
  });

  it('run a simple echo test', (done) => {
    var input = arraybuffers.stringToArrayBuffer('arbitrary test string');
    var testModule = createTestModule();
    testModule.startEchoServer().then((port:number) => {
      return testModule.connect(port);
    }).then((connectionId:string) => {
      return testModule.echo(connectionId, input);
    }).then((output:ArrayBuffer) => {
      expect(arraybuffers.byteEquality(input, output)).toBe(true);
    }).catch((e:any) => {
      expect(e).toBeUndefined();
    }).then(done);
  });

  it('detects a remote close', (done) => {
    var input = arraybuffers.stringToArrayBuffer('arbitrary test string');
    var testModule = createTestModule();
    var connId : string;
    testModule.startEchoServer().then((port:number) => {
      return testModule.connect(port);
    }).then((connectionId:string) => {
      connId = connectionId;
      return testModule.echo(connectionId, input);
    }).then((output:ArrayBuffer) => {
      expect(arraybuffers.byteEquality(input, output)).toBe(true);
      testModule.on('sockClosed', (cnnid:string) => {
        expect(cnnid).toBe(connId);
        done();
      });
      testModule.closeEchoConnections();
    });
  });

  it('run multiple echo tests in a batch on one connection', (done) => {
    var testBuffers = testStrings.map(arraybuffers.stringToArrayBuffer);
    var testModule = createTestModule();
    testModule.startEchoServer().then((port:number) => {
      return testModule.connect(port);
    }).then((connectionId:string) => {
      return testModule.echoMultiple(connectionId, testBuffers);
    }).then((outputs:ArrayBuffer[]) => {
      var concatenatedInputs = arraybuffers.concat(testBuffers);
      var concatenatedOutputs = arraybuffers.concat(outputs);
      var isEqual = arraybuffers.byteEquality(concatenatedInputs, concatenatedOutputs);
      expect(isEqual).toBe(true);
    }).catch((e:any) => {
      expect(e).toBeUndefined();
    }).then(done);
  });

  it('run multiple echo tests in series on one connection', (done) => {
    var testBuffers = testStrings.map(arraybuffers.stringToArrayBuffer);
    var testModule = createTestModule();
    testModule.startEchoServer().then((port:number) => {
      return testModule.connect(port);
    }).then((connectionId:string) => {
      var i = 0;
      return new Promise<void>((F, R) => {
        var step = () => {
          if (i == testBuffers.length) {
            F();
            return;
          }
          testModule.echo(connectionId, testBuffers[i])
              .then((echo:ArrayBuffer) => {
            expect(arraybuffers.byteEquality(testBuffers[i], echo)).toBe(true);
            ++i;
          }).then(step);
        };
        step();
      });
    }).catch((e:any) => {
      expect(e).toBeUndefined();
    }).then(done);
  });

  it('connect to the same server multiple times in parallel', (done) => {
    var testModule = createTestModule();
    testModule.startEchoServer().then((port:number) : Promise<any> => {
      var promises = testStrings.map((s:string) : Promise<void> => {
        var buffer = arraybuffers.stringToArrayBuffer(s);
        return testModule.connect(port).then((connectionId:string) => {
          return testModule.echo(connectionId, buffer);
        }).then((response:ArrayBuffer) => {
          expect(arraybuffers.byteEquality(buffer, response)).toBe(true);
        });
      });
      return Promise.all(promises);
    }).catch((e:any) => {
      expect(e).toBeUndefined();
    }).then(done);
  });

  it('connect to many different servers in parallel', (done) => {
    var testModule = createTestModule();
    var promises = testStrings.map((s:string) : Promise<void> => {
      var buffer = arraybuffers.stringToArrayBuffer(s);

      // For each string, start a new echo server with that name, and
      // then echo that string from that server.
      return testModule.startEchoServer().then((port:number) => {
        return testModule.connect(port);
      }).then((connectionId:string) => {
        return testModule.echo(connectionId, buffer);
      }).then((response:ArrayBuffer) => {
        expect(arraybuffers.byteEquality(buffer, response)).toBe(true);
      });
    });

    Promise.all(promises).catch((e:any) => {
      expect(e).toBeUndefined();
    }).then(done);
  });

  it('run a localhost echo test while localhost is blocked.', (done) => {
    // Get a test module that doesn't allow localhost access.
    var testModule = createTestModule(true);
    testModule.startEchoServer().then((port:number) => {
      return testModule.connect(port);
    }).then((connectionId:string) => {
      // This code should not run, because testModule.connect() should
      // reject with a NOT_ALLOWED error.
      expect(connectionId).toBeUndefined();
    }, (e:any) => {
      expect(e.reply).toEqual(socks.Reply.NOT_ALLOWED);
    }).then(done);
  });

  var runUproxyOrg404Test = (testModule:ProxyIntegrationTester,
      done:Function) => {
    var nonExistentPath = '/noSuchPath';
    var input = arraybuffers.stringToArrayBuffer(
        'GET ' + nonExistentPath + ' HTTP/1.0\r\n\r\n');
    testModule.connect(80, 'uproxy.org').then((connectionId:string) => {
      var isDone = false;
      var outputString = '';
      testModule.on('receivedData', (event:ReceivedDataEvent) => {
        if (isDone) {
          return;
        }
        expect(event.connectionId).toEqual(connectionId);
        outputString += arraybuffers.arrayBufferToString(event.response);
        if ((outputString.indexOf('HTTP/1.0 404 Not Found') != -1 &&
            outputString.indexOf(nonExistentPath) != -1) ||
            outputString.indexOf('HTTP/1.1 403 Forbidden') != -1) {
          isDone = true;
          done();
        }
      });
      return testModule.sendData(connectionId, input);
    }).catch((e:any) => {
      expect(e).toBeUndefined();
    });
  };

  it('fetch from non-localhost address', (done) => {
    var testModule = createTestModule();
    runUproxyOrg404Test(testModule, done);
  });

  it('fetch from non-localhost address while localhost is blocked.', (done) => {
    var testModule = createTestModule(true);
    runUproxyOrg404Test(testModule, done);
  });

  it('do a request that gets blocked, then another that succeeds.', (done) => {
    var nonExistentPath = '/noSuchPath';
    var input = arraybuffers.stringToArrayBuffer(
        'GET ' + nonExistentPath + ' HTTP/1.0\r\n\r\n');
    // Get a test module that doesn't allow localhost access.
    var testModule = createTestModule(true);
    // Try to connect to localhost, and fail
    testModule.connect(1023).then((connectionId:string) => {
      // This code should not run, because testModule.connect() should
      // reject with a NOT_ALLOWED error.
      expect(connectionId).toBeUndefined();
    }, (e:any) => {
      expect(e.reply).toEqual(socks.Reply.NOT_ALLOWED);
    }).then(() => {
      runUproxyOrg404Test(testModule, done);
    });
  });

  it('run a localhost-resolving DNS name echo test while localhost is blocked.', (done) => {
    // Get a test module with one that doesn't allow localhost access.
    var testModule = createTestModule(true);
    testModule.startEchoServer().then((port:number) => {
      return testModule.connect(port, 'www.127.0.0.1.xip.io');
    }).then((connectionId:string) => {
      // This code should not run, because testModule.connect() should
      // reject.
      expect(connectionId).toBeUndefined();
    }, (e:any) => {
      // On many networks, www.127.0.0.1.xip.io is non-resolvable, because
      // corporate DNS can drop responses that resolve to local network
      // addresses.  Accordingly, the error code may either indicate
      // HOST_UNREACHABLE (if resolution fails) or NOT_ALLOWED if name
      // resolution succeeds.  However, to avoid portscanning leaks
      // (https://github.com/uProxy/uproxy/issues/809) NOT_ALLOWED will be reported
      // as FAILURE
      expect([socks.Reply.HOST_UNREACHABLE, socks.Reply.FAILURE]).toContain(e.reply);
    }).then(done);
  });

  it('attempt to connect to a nonexistent echo daemon', (done) => {
    var testModule = createTestModule();
    // 1023 is a reserved port.
    testModule.connect(1023).then((connectionId:string) => {
      // This code should not run, because there is no server on this port.
      expect(connectionId).toBeUndefined();
    }).catch((e:any) => {
      expect(e.reply).toEqual(socks.Reply.CONNECTION_REFUSED);
    }).then(done);
  });

  it('attempt to connect to a nonexistent echo daemon while localhost is blocked', (done) => {
    var testModule = createTestModule(true);
    // 1023 is a reserved port.
    testModule.connect(1023).then((connectionId:string) => {
      // This code should not run, because localhost is blocked.
      expect(connectionId).toBeUndefined();
    }).catch((e:any) => {
      expect(e.reply).toEqual(socks.Reply.NOT_ALLOWED);
    }).then(done);
  });

  it('attempt to connect to a nonexistent local echo daemon while localhost is blocked as 0.0.0.0', (done) => {
    var testModule = createTestModule(true);
    // 1023 is a reserved port.
    testModule.connect(1023, '0.0.0.0').then((connectionId:string) => {
      // This code should not run because the destination is invalid.
      expect(connectionId).toBeUndefined();
    }).catch((e:any) => {
      // TODO: Make this just NOT_ALLOWED once this bug in ipadddr.js is fixed:
      // https://github.com/whitequark/ipaddr.js/issues/9
      expect([socks.Reply.NOT_ALLOWED, socks.Reply.FAILURE]).toContain(e.reply);
    }).then(done);
  });

  it('attempt to connect to a nonexistent local echo daemon while localhost is blocked as IPv6', (done) => {
    var testModule = createTestModule(true);
    // 1023 is a reserved port.
    testModule.connect(1023, '::1').then((connectionId:string) => {
      // This code should not run, because localhost is blocked.
      expect(connectionId).toBeUndefined();
    }).catch((e:any) => {
      expect(e.reply).toEqual(socks.Reply.NOT_ALLOWED);
    }).then(done);
  });

  it('attempt to connect to a local network IP address while it is blocked', (done) => {
    var testModule = createTestModule(true);
    // 1023 is a reserved port.
    testModule.connect(1023, '10.5.5.5').then((connectionId:string) => {
      // This code should not run, because local network access is blocked.
      expect(connectionId).toBeUndefined();
    }).catch((e:any) => {
      expect(e.reply).toEqual(socks.Reply.NOT_ALLOWED);
    }).then(done);
  });

  it('connection refused from DNS name', (done) => {
    var testModule = createTestModule();
    // Many sites (such as uproxy.org) seem to simply ignore SYN packets on
    // unmonitored ports, but openbsd.org actually refuses the connection as
    // expected.
    testModule.connect(1023, 'openbsd.org').then((connectionId:string) => {
      // This code should not run, because there is no server on this port.
      expect(connectionId).toBeUndefined();
    }).catch((e:any) => {
      expect(e.reply).toEqual(socks.Reply.CONNECTION_REFUSED);
    }).then(done);
  });

  it('connection refused from DNS name while localhost is blocked', (done) => {
    var testModule = createTestModule(true);
    // Many sites (such as uproxy.org) seem to simply ignore SYN packets on
    // unmonitored ports, but openbsd.org actually refuses the connection as
    // expected.
    testModule.connect(1023, 'openbsd.org').then((connectionId:string) => {
      // This code should not run, because there is no server on this port.
      expect(connectionId).toBeUndefined();
    }).catch((e:any) => {
      // This should be CONNECTION_REFUSED, but since we can't be sure that the
      // domain isn't on the local network, and we're concerned about port
      // scanning, we return the generic FAILURE code instead.
      // See https://github.com/uProxy/uproxy/issues/809.
      expect(e.reply).toEqual(socks.Reply.FAILURE);
    }).then(done);
  });

  it('attempt to connect to a nonexistent DNS name', (done) => {
    var testModule = createTestModule(true);
    testModule.connect(80, 'www.nonexistentdomain.gov').then((connectionId:string) => {
      // This code should not run, because there is no such DNS name.
      expect(connectionId).toBeUndefined();
    }).catch((e:any) => {
      expect(e.reply).toEqual(socks.Reply.HOST_UNREACHABLE);
    }).then(done);
  });

  it('Hit the session limit', (done) => {
    var limit = 4;
    var testModule = createTestModule(false, limit);

    var workingConnections : Promise<void>[] = [];

    testModule.startEchoServer().then((port:number) => {
      for (var i = 0; i < limit; ++i) {
        // Connections up to the limit are allowed.
        workingConnections.push(testModule.connect(port).catch((e) => {
          // These should not fail.
          expect(e).toBeUndefined();
        }));
      }
      // This one is over the limit so it should fail to open.
      testModule.connect(port).catch((e) => {
        // Wait for the working connections to succeed.
        Promise.all(workingConnections).then(done);
      });
    });
  });

  // TODO: Enable this test once https://code.google.com/p/webrtc/issues/detail?id=4823
  // is fixed.
  xit('run a simple echo test but force IPv6 transport', (done) => {
    var input = arraybuffers.stringToArrayBuffer('arbitrary test string');
    var testModule = createTestModule(undefined, undefined, true);
    testModule.startEchoServer().then((port:number) => {
      return testModule.connect(port);
    }).then((connectionId:string) => {
      return testModule.echo(connectionId, input);
    }).then((output:ArrayBuffer) => {
      expect(arraybuffers.byteEquality(input, output)).toBe(true);
    }).catch((e:any) => {
      expect(e).toBeUndefined();
    }).then(done);
  });
};
