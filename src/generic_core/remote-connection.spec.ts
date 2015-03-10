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
/// <reference path='mocks/rtc-to-net.ts' />
/// <reference path='mocks/socks-to-rtc.ts' />

describe('Core.RemoteConnection', () => {
  var connection :Core.RemoteConnection;
  var socksToRtc :SocksToRtcMock
  var rtcToNet :RtcToNetMock;
  var handleUpdate :(x :uProxy.Update, data?:Object) => void;

  beforeEach(() => {
    // always use spy objects for RtcToNet and SocksToRtc
    socksToRtc = new SocksToRtcMock();
    rtcToNet = new RtcToNetMock();

    spyOn(SocksToRtc, 'SocksToRtc').and.returnValue(socksToRtc);
    spyOn(RtcToNet, 'RtcToNet').and.returnValue(rtcToNet);

    handleUpdate = jasmine.createSpy('handleUpdate');
    connection = new Core.RemoteConnection(handleUpdate);
  });

  describe('client setup', () => {
    it('basic setup', () => {
      spyOn(socksToRtc, 'start').and.callThrough();

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
      socksToRtc.resolveStart(null);

      start.then(() => {
        expect(connection.localGettingFromRemote).toEqual(GettingState.GETTING_ACCESS);
        done();
      }).catch(() => {
        expect(false).toBe(true);
      });
    });

    it('cleanup after failure to start', (done) => {
      var start = connection.startGet();

      socksToRtc.rejectStart(Error('fake rejection'));

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

      rtcToNet.resolveReady();

      rtcToNet.onceReady.then(() => {
        expect(connection.localSharingWithRemote).toEqual(SharingState.SHARING_ACCESS);
        done();
      }).catch(() => {
        expect(false).toBe(true);
      });
    });

    it('cleanup after failure to start', (done) => {
      connection.startShare();

      rtcToNet.rejectReady(Error('fake rejection'));

      rtcToNet.onceReady.then(() => {
        expect(false).toBe(true);
      }).catch(() => {
        expect(connection.localSharingWithRemote).toEqual(SharingState.NONE);
        done();
      });
    });

    it('close after successful start', (done) => {
      connection.startShare();

      rtcToNet.resolveReady();
      rtcToNet.onceReady.then(() => {
        expect(connection.localSharingWithRemote).toEqual(SharingState.SHARING_ACCESS);
        rtcToNet.resolveClosed();
        return rtcToNet.onceClosed;
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
      socksToRtc.resolveStart(null);

      start.then(() => {
        // trigger the events
        socksToRtc.events['bytesReceivedFromPeer'](1234);
        socksToRtc.events['bytesSentToPeer'](4321);

        // handleUpdate should not get called immediately for byte updates
        jasmine.clock().tick(1);
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
      spyOn(rtcToNet, 'handleSignalFromPeer');
      spyOn(socksToRtc, 'handleSignalFromPeer');

      connection.handleSignal({
        type: uProxy.MessageType.SIGNAL_FROM_CLIENT_PEER,
        data: {}
      });

      expect(rtcToNet.handleSignalFromPeer).not.toHaveBeenCalled();
      expect(socksToRtc.handleSignalFromPeer).not.toHaveBeenCalled();
    });

    it('signal from server with no setup', () => {
      spyOn(rtcToNet, 'handleSignalFromPeer');
      spyOn(socksToRtc, 'handleSignalFromPeer');

      connection.handleSignal({
        type: uProxy.MessageType.SIGNAL_FROM_SERVER_PEER,
        data: {}
      });

      expect(rtcToNet.handleSignalFromPeer).not.toHaveBeenCalled();
      expect(socksToRtc.handleSignalFromPeer).not.toHaveBeenCalled();
    });
  });

});
