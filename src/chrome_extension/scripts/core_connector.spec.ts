/// <reference path='../../../third_party/DefinitelyTyped/jasmine/jasmine.d.ts' />
/// <reference path='core_connector.ts' />

// Mock for the Chrome App's port as if the App actually exists.
var mockAppPort = () => {
  return {
    postMessage: (msg :string) => {},
    disconnect: () => {},
    onDisconnect: {
      addListener: () => {},
      removeListener: () => {}
    },
    onMessage: {
      addListener: () => {},
      removeListener: () => {}
    },
    name: 'mock-port'
  };
};


describe('core-connector', () => {

  var core :ChromeCoreConnector;
  core = new ChromeCoreConnector();
  var connectPromise :Promise<chrome.runtime.Port>;

  beforeEach(() => {});

  it('attempts chrome.runtime.connect().', () => {
    spyOn(core, 'connect').and.callThrough()
    spyOn(chrome.runtime, 'connect').and.returnValue(null);
    connectPromise = core.connect();
    expect(chrome.runtime.connect).toHaveBeenCalled();
  });

  it('fails to connect with no App present.', (done) => {
    connectPromise.catch((e) => {
      expect(core['appPort_']).toEqual(null);
    }).then(done);
  });

  it('continues polling while disconnected.', (done) => {
    // Spying on core.connect with a fake will prevent it from polling again,
    // after it's been caughts (So later we have to start fresh).
    spyOn(core, 'connect').and.callFake(() => {
      console.log('caught connection retry.');
      done();
    });
  });

  it('connects to App when present.', (done) => {
    var port = mockAppPort();
    var acker = null;
    // Change the set of spies.
    spyOn(core, 'connect').and.callThrough();
    spyOn(chrome.runtime, 'connect').and.returnValue(port);
    // Grab the ack function from the internals.
    spyOn(port.onMessage, 'addListener').and.callFake((handler) => {
      acker = handler;
    });
    spyOn(port, 'postMessage').and.callFake((msg) => {
      expect(port.postMessage).toHaveBeenCalledWith('hi');
      // spyOn(this, 'acker').and.callThrough();
      // This is where the Chrome App is expected to pass the ACK back.
      acker(ChromeGlue.HELLO);
      done();
    });
    // TODO: There is some scope problem about the promise not fulfilling.
    core.connect();
  });

});
