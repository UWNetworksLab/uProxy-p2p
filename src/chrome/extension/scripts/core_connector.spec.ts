/// <reference path='core_connector.ts' />
/// <reference path='../../../interfaces/lib/jasmine/jasmine.d.ts' />


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

  var port = mockAppPort();
  var disconnect :Function = null;

  it('connects to App when present.', (done) => {
    var acker = null;
    // A 'valid' chrome.runtime.Port indicates successful connection.
    spyOn(chrome.runtime, 'connect').and.returnValue(port);
    spyOn(port.onMessage, 'addListener').and.callFake((handler) => {
      if (null !== acker) {
        expect(handler).toEqual(connector['receive_']);
        return;
      }
      spyOn(port.onMessage, 'removeListener');
      // Extract ack function from the depths of connector.
      acker = handler;
    });
    // Short-circuit postMessage to pretend Chrome App ACKS correctly.
    spyOn(port, 'postMessage').and.callFake((msg) => {
      expect(port.postMessage).toHaveBeenCalledWith(ChromeGlue.CONNECT);
      expect(acker).not.toBeNull();
      acker(ChromeGlue.ACK);
    });

    // Capture the disconnection fulfillment or next spec.
    spyOn(port.onDisconnect, 'addListener').and.callFake((f) => {
      disconnect = f;
    });

    // Begin successful connection attempt to App.
    expect(connector.status.connected).toEqual(false);
    connector.connect().then((p :chrome.runtime.Port) => {
      expect(connector['appPort_']).not.toBeNull();
      console.log(p);
      expect(connector['appPort_']).toEqual(p);
      expect(port.onMessage.removeListener).toHaveBeenCalled();
      expect(connector.status.connected).toEqual(true);
      expect(connector.onceDisconnected()).not.toBeNull();
    }).then(done);
  });

  var resumedPolling = false;

  it('gets disconnected when App disappears.', (done) => {
    expect(disconnect).not.toBeNull();
    connector.onceDisconnected().then(() => {
      expect(connector.status.connected).toEqual(false);
      expect(connector['appPort_']).toBeNull();
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

  it('send_ queues message while disconnected.', () => {
    var payload = { cmd: 'test1', type: 1 };
    connector['send_'](payload);
    expect(connector['queue_']).toEqual([
        { cmd: 'test1', type: 1 }
    ]);
  });

  it('queues messages in the right order.', () => {
    var payload = { cmd: 'test2', type: 2 };
    connector['send_'](payload);
    expect(connector['queue_']).toEqual([
        { cmd: 'test1', type: 1 },
        { cmd: 'test2', type: 2 }
    ]);
  });

  var flushed = false;

  // This is a stripped down version of a previous spec, to get the
  // ChromeAppConnector into a consistent state for testing the communications
  // specs.
  it('reconnects to App when it returns.', (done) => {
    var port = mockAppPort();
    var acker = null;
    spyOn(chrome.runtime, 'connect').and.returnValue(port);
    spyOn(port.onMessage, 'addListener').and.callFake((handler) => {
      if (null !== acker) { return; }
      acker = handler;
    });
    spyOn(port, 'postMessage').and.callFake((msg) => {
      acker(ChromeGlue.ACK);
    });
    // Spy the queue flusher for the next spec.
    spyOn(connector, 'flushQueue').and.callFake(() => {
      flushed = true;
    });
    // Begin successful connection attempt to App.
    expect(connector.status.connected).toEqual(false);
    connector.connect().then(() => {
      expect(connector.status.connected).toEqual(true);
    }).then(done);
  });

  it('flushes queue upon connection.', () => {
    expect(flushed).toEqual(true);
  });

  it('flushes the queue correctly.', () => {
    var flushed = [];
    spyOn(connector, 'send_').and.callFake((payload) => {
      flushed.push(payload);
    });
    connector.flushQueue();
    expect(connector['queue_']).toEqual([]);
    expect(flushed).toEqual([
        { cmd: 'test1', type: 1 },
        { cmd: 'test2', type: 2 }
    ]);
  });

  it('onUpdate calls send.', () => {
    spyOn(connector, 'send_');
    // TODO: Cannot use the uProxy.Update enum until the 'common' communications
    // connector.onUpdate(uProxy.Update.ALL, () => {});
    // typescript file is ready.
    // expect(connector['send_']).toHaveBeenCalledWith({
      // cmd: 'on',
      // type: uProxy.Update.ALL
    // });
  });

  // TODO: Test the rest of the Update and Command functionality.

});
