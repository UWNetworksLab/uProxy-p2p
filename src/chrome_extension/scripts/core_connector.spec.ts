/// <reference path='../../../third_party/DefinitelyTyped/jasmine/jasmine.d.ts' />
/// <reference path='core_connector.ts' />

// Mock for the Chrome App's port as if the App actually exists.
var mockAppPort = () => {
  return {
    name: 'mock-port',
    postMessage: (msg :string) => {},
    disconnect: () => {},
    onMessage: {
      addListener: () => {},
      removeListener: () => {}
    },
    onDisconnect: {
      addListener: () => {},
      removeListener: () => {}
    }
  };
};


// The ordering of the specs matter, as they provide a connect / disconnect
// sequence on the connector object.
describe('core-connector', () => {

  var connector :ChromeCoreConnector;
  connector = new ChromeCoreConnector();
  var connectPromise :Promise<chrome.runtime.Port>;

  beforeEach(() => {});

  it('attempts chrome.runtime.connect().', () => {
    spyOn(connector, 'connect').and.callThrough()
    // Get chrome.runtime.connect to return null as if there were no App to
    // connect to.
    spyOn(chrome.runtime, 'connect').and.returnValue(null);
    connectPromise = connector.connect();
    expect(chrome.runtime.connect).toHaveBeenCalled();
  });

  it('fails to connect with no App present.', (done) => {
    connectPromise.catch((e) => {
      expect(connector.status.connected).toEqual(false);
      expect(connector['appPort_']).toEqual(null);
    }).then(done);
  });

  it('continues polling while disconnected.', (done) => {
    // Spying with a fake will prevent the actual implementations polling
    // behavior after its caught. This allows the next spec to start fresh.
    spyOn(connector, 'connect').and.callFake(() => {
      console.log('caught connection retry.');
      connectPromise = null;
      done();
    });
  });

  var disconnect :Function = null;

  it('connects to App when present.', (done) => {
    var port = mockAppPort();
    var acker = null;
    // A 'valid' chrome.runtime.Port indicates successful connection.
    spyOn(chrome.runtime, 'connect').and.returnValue(port);
    spyOn(port.onMessage, 'addListener').and.callFake((handler) => {
      if (null !== acker) {
        // This is the replacement addListener for the update mechanism.
        expect(handler).toEqual(connector['dispatchFreedomEvent_']);
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

    // Capture the disconnection fulfillment or next spec.
    spyOn(port.onDisconnect, 'addListener').and.callFake((f) => {
      disconnect = f;
    });

    // Begin successful connection attempt to App.
    expect(connector.status.connected).toEqual(false);
    connector.connect().then((p :chrome.runtime.Port) => {
      expect(connector['appPort_']).not.toBeNull();
      expect(connector['appPort_']).toEqual(p);
      expect(port.onMessage.removeListener).toHaveBeenCalled();
      expect(port.onDisconnect.addListener).toHaveBeenCalled();
      expect(connector.status.connected).toEqual(true);
      expect(connector.onceDisconnected()).not.toBeNull();
    }).then(done);
  });

  var resumedPolling = false;

  it('disconnects from App when port disconnects.', (done) => {
    expect(disconnect).not.toBeNull();
    connector.onceDisconnected().then(() => {
      expect(connector.status.connected).toEqual(false);
      expect(connector['appPort_']).toBeFalsy();
      expect(connector['listeners_']).toEqual({});
    }).then(done);
    // Catch re-connect() attempt for next spec.
    spyOn(connector, 'connect').and.callFake(() => {
      resumedPolling = true;
    });
    disconnect();
  });

  it('resumes polling once disconnected.', () => {
    expect(resumedPolling).toEqual(true);
    expect(connector.status.connected).toEqual(false);
  });

});
