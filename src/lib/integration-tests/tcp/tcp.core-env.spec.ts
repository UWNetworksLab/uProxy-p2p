/// <reference path='../../../../third_party/typings/browser.d.ts' />

declare const freedom: freedom.FreedomInCoreEnv;

// Coarse-grained tests for tcp.ts.
// The real work is done in the Freedom module which starts a test in response
// to a Freedom message and is expected to "echo" that messages iff the test
// succeeds.
// TODO: Move the code in the Freedom module to here, with many more
//       expectations. This depends on a test runner which can run its tests
//       *inside* of a Freedom module (rather than a Chrome app):
//         https://github.com/freedomjs/freedom/issues/146
describe('core.tcpsocket wrapper', function() {
  // TODO: This is flaky! figuring out why may help explain why
  //       the SOCKS server sometimes fails to start.
  it('listens and echoes', (done) => {
    loadFreedom('listen').then(done);
  });

  it('sends onceShutdown notifications', (done) => {
    loadFreedom('shutdown').then(done);
  });

  it('onceClosed by server', (done) => {
    loadFreedom('onceclosedbyserver').then(done);
  });

  it('onceClosed by client', (done) => {
    loadFreedom('onceclosedbyclient').then(done);
  });

  it('onceClosed returns NEVER_CONNECTED when client connection fails', (done) => {
    loadFreedom('neverconnected').then(done);
  });

  it('serves multiple clients', (done) => {
    loadFreedom('multipleclients').then(done);
  });

  it('connectionsCount', (done) => {
    loadFreedom('connectionscount').then(done);
  });

  // Loads the testing Freedom module, emits a signal and returns
  // a promise which fulfills once the signal is echoed.
  function loadFreedom(signalName:string) : Promise<void> {
    var path: string;
    if (typeof window == 'undefined') {
      // Firefox addon
      path = 'grunt-jasmine-firefoxaddon-runner/data/build/dev/uproxy-lib/integration-tests/tcp/';
    } else {
      // Chrome app
      path = 'files/';
    }
    return freedom(path + 'freedom-module.json', {
        'debug': 'debug'
      }).then((integrationTestFactory) => {
        return new Promise((F, R) => {
          var testModule = integrationTestFactory();
          testModule.emit(signalName);
          testModule.on(signalName, () => {
              F(testModule);
          });
        })
        // Cleanup! Note: this will not run if the test times out... TODO: do
        // we really want close on an promise rejection? better to error then?
        .then(integrationTestFactory.close,
          (e) => {
            throw new Error('Failed to run test module: ' + e.toString());
          });
      });
  }
});
