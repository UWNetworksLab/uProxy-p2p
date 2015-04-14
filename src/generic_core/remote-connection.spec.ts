/*
 * remote-connection.spec.ts
 *
 * This checks that the necessary infrastructure for establishing a connection
 * to a remote uproxy client is correct in addition to handling of events
 * after that connection is established
 */
/// <reference path='../../../third_party/typings/jasmine/jasmine.d.ts' />
/// <reference path='../webrtc/peerconnection.d.ts' />
/// <reference path='remote-connection.ts' />
/// <reference path='../mocks/rtc-to-net.ts' />
/// <reference path='../mocks/socks-to-rtc.ts' />

describe('remote_connection.RemoteConnection', () => {
  var connection :remote_connection.RemoteConnection;
  var socksToRtc :SocksToRtcMock
  var rtcToNet :RtcToNetMock;
  var updateSpy :(x :uproxy_core_api.Update, data?:Object) => void;

  // TODO replace with jasmine's builtin fail function once
  // grunt-contrib-jasmine includes the latest jasmine version
  function failTest() {
    expect(false).toBe(true);
  }

  beforeEach(() => {
    // always use spy objects for RtcToNet and SocksToRtc
    socksToRtc = new SocksToRtcMock();
    rtcToNet = new RtcToNetMock();

    // TODO RemoteConnection should eventually be modified to take
    // implementations for the stream connectors as constructor arguments
    spyOn(SocksToRtc, 'SocksToRtc').and.returnValue(socksToRtc);
    spyOn(RtcToNet, 'RtcToNet').and.returnValue(rtcToNet);

    updateSpy = jasmine.createSpy('updateSpy');
    connection = new remote_connection.RemoteConnection(updateSpy);
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
      }).catch(failTest);
    });

    it('cleanup after failure to start', (done) => {
      var start = connection.startGet();

      socksToRtc.rejectStart(Error('fake rejection'));

      start.then(failTest).catch(done);
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
      }).catch(failTest);
    });

    it('cleanup after failure to start', (done) => {
      connection.startShare();

      rtcToNet.rejectReady(Error('fake rejection'));

      rtcToNet.onceReady.then(failTest)
      .catch(() => {
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
      }).catch(failTest);
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

        // updateSpy should not get called immediately for byte updates
        jasmine.clock().tick(1);
        expect(updateSpy).not.toHaveBeenCalledWith(uproxy_core_api.Update.STATE, jasmine.objectContaining({
          bytesSent: 4321,
          bytesReceived: 1234
        }));

        // byte updates should be batched and sent every second
        jasmine.clock().tick(1000);
        expect(updateSpy).toHaveBeenCalledWith(uproxy_core_api.Update.STATE, jasmine.objectContaining({
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
