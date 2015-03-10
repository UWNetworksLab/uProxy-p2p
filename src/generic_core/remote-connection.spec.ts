/*
 * remote-connection.spec.ts
 *
 * This checks that the necessary infrastructure for establishing a connection
 * to a remote uproxy client is correct in addition to handling of events
 * after that connection is established
 */
/// <reference path='../third_party/typings/jasmine/jasmine.d.ts' />
/// <reference path='../webrtc/peerconnection.d.ts' />
/// <reference path='remote-connection.ts' />

class MockSyncHandler {
  public syncHandler :(...data :Object[]) => void;
  public setSyncHandler = (fn :(...data :Object[]) => void) => {
    this.syncHandler = fn;
  }
}

describe('Core.RemoteConnection', () => {
  var socksToRtc :SocksToRtc.SocksToRtc;
  var socksToRtcEvents :{ [event :string] :(...args :Object[]) => void };
  var socksToRtcStart :Promise<Net.Endpoint>;
  var socksToRtcResolveStart : (v :Object) => void;
  var socksToRtcRejectStart : (v :Object) => void;
  var connection :Core.RemoteConnection;

  var rtcToNet :RtcToNet.RtcToNet;
  var rtcToNetClosed :Promise<void>;
  var rtcToNetResolveClosed :() => void;
  var rtcToNetRejectClosed :(v :Object) => void;
  var rtcToNetReady :Promise<void>;
  var rtcToNetResolveReady :() => void;
  var rtcToNetRejectReady :(v :Object) => void;

  var handleUpdate :(x :uProxy.Update, data?:Object) => void;

  beforeEach(() => {
    // always use spy objects for RtcToNet and SocksToRtc
    socksToRtc = jasmine.createSpyObj<SocksToRtc.SocksToRtc>('SocksToRtc', ['start', 'stop', 'handleSignalFromPeer', 'on']);
    rtcToNet = jasmine.createSpyObj<RtcToNet.RtcToNet>('RtcToNet', ['start', 'close', 'handleSignalFromPeer', 'toString']);
    handleUpdate = jasmine.createSpy('handleUpdate');

    rtcToNet.signalsForPeer = <Handler.Queue<WebRtc.SignallingMessage, void>><any>new MockSyncHandler();
    rtcToNet.bytesReceivedFromPeer = <Handler.Queue<number, void>><any>new MockSyncHandler();
    rtcToNet.bytesSentToPeer = <Handler.Queue<number, void>><any>new MockSyncHandler();

    spyOn(SocksToRtc, 'SocksToRtc').and.returnValue(socksToRtc);
    spyOn(RtcToNet, 'RtcToNet').and.returnValue(rtcToNet);

    socksToRtcEvents = {};
    socksToRtc.on.and.callFake((name :string, fn) => { // TODO typechecking
      socksToRtcEvents[name] = fn;
    });

    socksToRtcStart = new Promise<Net.Endpoint>((resolve, reject) => {
      socksToRtcResolveStart = resolve;
      socksToRtcRejectStart = reject;
    });
    socksToRtc.start.and.returnValue(socksToRtcStart); // TODO typechecking

    rtcToNetReady = new Promise<void>((resolve, reject) => {
      rtcToNetResolveReady = resolve;
      rtcToNetRejectReady = reject;
    });
    rtcToNet.onceReady = rtcToNetReady;

    rtcToNetClosed = new Promise<void>((resolve, reject) => {
      rtcToNetResolveClosed = resolve;
      rtcToNetRejectClosed = reject;
    });
    rtcToNet.onceClosed = rtcToNetClosed;

    connection = new Core.RemoteConnection(handleUpdate);
  });

  describe('client setup', () => {
    it('basic setup', () => {
      connection.startGet();

      expect(socksToRtc.start).toHaveBeenCalled();
      expect(connection.localGettingFromRemote).toEqual(GettingState.TRYING_TO_GET_ACCESS);
    });

    it('starting get twice fails', () => {
      connection.startGet();
      expect(connection.startGet).toThrow();
    });

    it('getting access after success', (done) => {
      var start = connection.startGet();
      socksToRtcResolveStart(null);

      start.then(() => {
        expect(connection.localGettingFromRemote).toEqual(GettingState.GETTING_ACCESS);
        done();
      }).catch(() => {
        expect(false).toBe(true);
      });
    });

    it('cleanup after failure to start', (done) => {
      var start = connection.startGet();

      socksToRtcRejectStart(Error('fake rejection'));

      start.then(() => {
        expect(false).toBe(true);
      }).catch(() => {
        done();
      });
    });
  });

  describe('server setup', () => {
    it('basic setup', () => {
      connection.startShare();

      expect(RtcToNet.RtcToNet).toHaveBeenCalled();
      expect(connection.localSharingWithRemote).toEqual(SharingState.TRYING_TO_SHARE_ACCESS);
    });

    it('sharing access after success', (done) => {
      connection.startShare();

      rtcToNetResolveReady();

      rtcToNetReady.then(() => {
        expect(connection.localSharingWithRemote).toEqual(SharingState.SHARING_ACCESS);
        done();
      }).catch(() => {
        expect(false).toBe(true);
      });
    });

    it('cleanup after failure to start', (done) => {
      connection.startShare();

      rtcToNetRejectReady(Error('fake rejection'));

      rtcToNetReady.then(() => {
        expect(false).toBe(true);
      }).catch(() => {
        expect(connection.localSharingWithRemote).toEqual(SharingState.NONE);
        done();
      });
    });

    it('close after successful start', (done) => {
      connection.startShare();

      rtcToNetResolveReady();
      rtcToNetReady.then(() => {
        expect(connection.localSharingWithRemote).toEqual(SharingState.SHARING_ACCESS);
        rtcToNetResolveClosed();
        return rtcToNetClosed;
      }).then(() => {
        expect(connection.localSharingWithRemote).toEqual(SharingState.NONE);
        done();
      }).catch(() => {
        expect(false).toBe(true);
      });
    });

  });

  describe('bytes sent/received', () => {
    it('getting connection', (done) => {
      jasmine.clock().install();
      var start = connection.startGet();
      socksToRtcResolveStart(null);

      start.then(() => {
        // trigger the events
        socksToRtcEvents['bytesReceivedFromPeer'](1234);
        socksToRtcEvents['bytesSentToPeer'](4321);

        // handleUpdate should not get called immediately for byte updates
        jasmine.clock().tick(10);
        expect(handleUpdate).not.toHaveBeenCalledWith(uProxy.Update.STATE, jasmine.objectContaining({
          bytesSent: 4321,
          bytesReceived: 1234
        }));

        // advance a second, make sure handleUpdate has been called
        jasmine.clock().tick(1000);
        expect(handleUpdate).toHaveBeenCalledWith(uProxy.Update.STATE, jasmine.objectContaining({
          bytesSent: 4321,
          bytesReceived: 1234
        }));

        jasmine.clock().uninstall();
        done();
      });

    });
  });

  describe('signal handling', () => {
    it('signal from client with no setup', () => {
      connection.handleSignal({
        type: uProxy.MessageType.SIGNAL_FROM_CLIENT_PEER,
        data: {}
      });

      expect(rtcToNet.handleSignalFromPeer).not.toHaveBeenCalled();
      expect(socksToRtc.handleSignalFromPeer).not.toHaveBeenCalled();
    });

    it('signal from server with no setup', () => {
      connection.handleSignal({
        type: uProxy.MessageType.SIGNAL_FROM_SERVER_PEER,
        data: {}
      });

      expect(rtcToNet.handleSignalFromPeer).not.toHaveBeenCalled();
      expect(socksToRtc.handleSignalFromPeer).not.toHaveBeenCalled();
    });
  });

});
