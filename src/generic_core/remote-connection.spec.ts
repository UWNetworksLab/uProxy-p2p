/// <reference path='../../../third_party/typings/index.d.ts' />

/*
 * remote-connection.spec.ts
 *
 * This checks that the necessary infrastructure for establishing a connection
 * to a remote uproxy client is correct in addition to handling of events
 * after that connection is established
 */

import freedomMocker = require('../lib/freedom/mocks/mock-freedom-in-module-env');

import freedom_mocks = require('../mocks/freedom-mocks');
declare var freedom: freedom.FreedomInModuleEnv;
freedom = freedomMocker.makeMockFreedomInModuleEnv({
  'core.storage': () => { return new freedom_mocks.MockFreedomStorage(); },
  'core.tcpsocket': () => { return new freedom_mocks.MockTcpSocket(); },
  'metrics': () => { return new freedom_mocks.MockMetrics(); },
  'pgp': () => { return new freedom_mocks.PgpProvider() },
  'portControl': () => { return new Object },
});

import constants = require('./constants');
import remote_connection = require('./remote-connection');
import social = require('../interfaces/social');
import uproxy_core_api = require('../interfaces/uproxy_core_api');
import rtc_to_net = require('../lib/rtc-to-net/rtc-to-net');
import socks_to_rtc = require('../lib/socks-to-rtc/socks-to-rtc');
import rtc_to_net_mock = require('../mocks/rtc-to-net');
import socks_to_rtc_mock = require('../mocks/socks-to-rtc');

describe('remote_connection.RemoteConnection', () => {
  var connection :remote_connection.RemoteConnection;
  var socksToRtc :socks_to_rtc_mock.SocksToRtcMock
  var rtcToNet :rtc_to_net_mock.RtcToNetMock;
  var updateSpy :(x :uproxy_core_api.Update, data?:Object) => void;

  // TODO replace with jasmine's builtin fail function once
  // grunt-contrib-jasmine includes the latest jasmine version
  function failTest() {
    expect(false).toBe(true);
  }

  beforeEach(() => {
    // always use spy objects for RtcToNet and SocksToRtc
    socksToRtc = new socks_to_rtc_mock.SocksToRtcMock();
    rtcToNet = new rtc_to_net_mock.RtcToNetMock();

    // TODO RemoteConnection should eventually be modified to take
    // implementations for the stream connectors as constructor arguments
    spyOn(socks_to_rtc, 'SocksToRtc').and.returnValue(socksToRtc);
    spyOn(rtc_to_net, 'RtcToNet').and.returnValue(rtcToNet);

    updateSpy = jasmine.createSpy('updateSpy');
    connection = new remote_connection.RemoteConnection(updateSpy,
        'the userId');
  });

  describe('client setup', () => {
    it('basic setup', () => {
      spyOn(socksToRtc, 'start').and.callThrough();

      connection.startGet(constants.MESSAGE_VERSION);

      expect(socksToRtc.start).toHaveBeenCalled();
      expect(connection.localGettingFromRemote).toEqual(social.GettingState.TRYING_TO_GET_ACCESS);
    });

    it('starting get twice fails', () => {
      connection.startGet(constants.MESSAGE_VERSION);
      expect(connection.startGet).toThrow();
    });

    it('getting access after success', (done) => {
      var start = connection.startGet(constants.MESSAGE_VERSION);
      socksToRtc.resolveStart(null);

      start.then(() => {
        expect(connection.localGettingFromRemote).toEqual(social.GettingState.GETTING_ACCESS);
        done();
      }).catch(failTest);
    });

    it('cleanup after failure to start', (done) => {
      var start = connection.startGet(constants.MESSAGE_VERSION);

      socksToRtc.rejectStart(Error('fake rejection'));

      start.then(failTest).catch(done);
    });
  });

  describe('server setup', () => {
    it('basic setup', () => {
      connection.startShare(constants.MESSAGE_VERSION);

      expect(rtc_to_net.RtcToNet).toHaveBeenCalled();
      expect(connection.localSharingWithRemote).toEqual(social.SharingState.TRYING_TO_SHARE_ACCESS);
    });

    it('sharing access after success', (done) => {
      connection.startShare(constants.MESSAGE_VERSION);

      rtcToNet.resolveReady();

      rtcToNet.onceReady.then(() => {
        expect(connection.localSharingWithRemote).toEqual(social.SharingState.SHARING_ACCESS);
        done();
      }).catch(failTest);
    });

    it('cleanup after failure to start', (done) => {
      var onceReady = connection.startShare(constants.MESSAGE_VERSION);

      onceReady.then(failTest)
      .catch(() => {
        expect(connection.localSharingWithRemote).toEqual(social.SharingState.NONE);
        done();
      });

      rtcToNet.rejectReady(Error('fake rejection'));
    });

    it('close after successful start', (done) => {
      connection.startShare(constants.MESSAGE_VERSION);

      rtcToNet.onceReady.then(() => {
        expect(connection.localSharingWithRemote).toEqual(social.SharingState.SHARING_ACCESS);
        rtcToNet.resolveStopped();
        return rtcToNet.onceStopped;
      }).then(() => {
        expect(connection.localSharingWithRemote).toEqual(social.SharingState.NONE);
        done();
      }).catch(failTest);

      rtcToNet.resolveReady();
    });

  });

  describe('bytes sent/received', () => {
    it('getting connection', (done) => {
      jasmine.clock().install();
      var start = connection.startGet(constants.MESSAGE_VERSION);
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
        type: social.PeerMessageType.SIGNAL_FROM_CLIENT_PEER,
        data: {}
      });

      expect(rtcToNet.handleSignalFromPeer).not.toHaveBeenCalled();
      expect(socksToRtc.handleSignalFromPeer).not.toHaveBeenCalled();
    });

    it('signal from server with no setup', () => {
      spyOn(rtcToNet, 'handleSignalFromPeer');
      spyOn(socksToRtc, 'handleSignalFromPeer');

      connection.handleSignal({
        type: social.PeerMessageType.SIGNAL_FROM_SERVER_PEER,
        data: {}
      });

      expect(rtcToNet.handleSignalFromPeer).not.toHaveBeenCalled();
      expect(socksToRtc.handleSignalFromPeer).not.toHaveBeenCalled();
    });
  });

});
