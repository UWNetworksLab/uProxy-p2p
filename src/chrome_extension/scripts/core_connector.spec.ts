/// <reference path='../../../third_party/DefinitelyTyped/jasmine/jasmine.d.ts' />
/// <reference path='core_connector.ts' />

var mockPort = () => {
  return {
        postMessage: () => {},
        disconnect: () => {},
        onDisconnect: null,
        onMessage: null,
        name: 'mock-port'
  };
}

describe('core-connector', () => {

  var core :ChromeCoreConnector;
  core = new ChromeCoreConnector();
  var connectPromise :Promise<chrome.runtime.Port>;

  beforeEach(() => {
  });

  var fake = () => {
    console.log('called connect.');
  }

  spyOn(core, 'connect').and.callThrough()

  it('attempts chrome.runtime.connect().', () => {
    spyOn(chrome.runtime, 'connect');
    connectPromise = core.connect();
    expect(chrome.runtime.connect).toHaveBeenCalled();
  });

  it('fails to connect with no App present', (done) => {
    spyOn(chrome.runtime, 'connect').and.returnValue(null);
    connectPromise.catch((e) => {
      console.log(e);
      console.log(core);
      expect(core['appPort_']).toEqual(undefined);
    }).then(done);
  });

  it('continues polling while disconnected.', (done) => {
    spyOn(core, 'connect').and.callFake(() => {
      console.log('caught connection retry.');
      done();
    });
  });

});
