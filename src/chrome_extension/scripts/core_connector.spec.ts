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
    // Get chrome.runtime.connect to return null as if there were no App to
    // connect to.
    spyOn(chrome.runtime, 'connect').and.returnValue(null);
    connectPromise = core.connect();
    expect(chrome.runtime.connect).toHaveBeenCalled();
  });

  it('fails to connect with no App present.', (done) => {
    connectPromise.catch((e) => {
      expect(core.status.connected).toEqual(false);
      expect(core['appPort_']).toEqual(null);
    }).then(done);
  });

  it('continues polling while disconnected.', (done) => {
    // Spying on core.connect with a fake will prevent it from polling again,
    // after it's been caughts (So later we have to start fresh).
    spyOn(core, 'connect').and.callFake(() => {
      console.log('caught connection retry.');
      connectPromise = null;
      done();
    });
  });

  it('connects to App when present.', (done) => {
    var port = mockAppPort();
    var acker = null;
    spyOn(chrome.runtime, 'connect').and.returnValue(port);
    spyOn(port.onMessage, 'addListener').and.callFake((handler) => {
      if (null !== acker) {
        // This is the replacement addListener for the update mechanism.
        expect(handler).toEqual(core['dispatchFreedomEvent_']);
        return;
      }
      spyOn(port.onMessage, 'removeListener');
      // Extract ack function from the depths of connector.
      acker = handler;
    });
    // Short-circuit postMessage to pretend Chrome App ACKS correctly.
    spyOn(port, 'postMessage').and.callFake((msg) => {
      expect(port.postMessage).toHaveBeenCalledWith('hi');
      expect(acker).not.toBeNull();
      acker(ChromeGlue.HELLO);
    });

    // Begin successful connection attempt to App.
    expect(core.status.connected).toEqual(false);
    core.connect().then(() => {
      expect(port.onMessage.removeListener).toHaveBeenCalled();
      expect(core.status.connected).toEqual(true);
    }).then(done);
  });

});
