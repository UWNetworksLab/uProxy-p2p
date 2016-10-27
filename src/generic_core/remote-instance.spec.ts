/*
 * remote-instance.spec.ts
 *
 * This file ensures that interactions with a remote instance are correct. For
 * instance, sometimes consent between two instances needs to be resolved after
 * they've been disconnected. This must ensure that we resolve the
 * correct consent values between remote instances.
 */

import * as freedomMocker from '../lib/freedom/mocks/mock-freedom-in-module-env';

import * as freedom_mocks from '../mocks/freedom-mocks';
declare var freedom: freedom.FreedomInModuleEnv;
freedom = freedomMocker.makeMockFreedomInModuleEnv({
  'core.online': () => { return new freedom_mocks.MockFreedomOnline(); },
  'core.storage': () => { return new freedom_mocks.MockFreedomStorage(); },
  'core.tcpsocket': () => { return new freedom_mocks.MockTcpSocket(); },
  'metrics': () => { return new freedom_mocks.MockMetrics(); },
  'pgp': () => { return new freedom_mocks.PgpProvider() },
  'portControl': () => { return new Object },
});

import * as remote_user from './remote-user';
import * as consent from './consent';
import * as remote_instance from './remote-instance';
import * as social from '../interfaces/social';
import * as socks_to_rtc from '../lib/socks-to-rtc/socks-to-rtc';
import * as rtc_to_net from '../lib/rtc-to-net/rtc-to-net';
import * as globals from './globals';
import * as constants from './constants';
import * as local_storage from './storage';
import * as net from '../lib/net/net.types';
import * as local_instance from './local-instance';
import * as bridge from '../lib/bridge/bridge';
import * as rtc_to_net_mock from '../mocks/rtc-to-net';
import * as socks_to_rtc_mock from '../mocks/socks-to-rtc';

describe('remote_instance.RemoteInstance', () => {

  // Prepare a fake social.Network object to construct User on top of.
  var user = <remote_user.User><any>jasmine.createSpyObj('user', [
      'send',
      'notifyUI',
      'instanceToClient',
      'sendInstanceHandshake',
      'updateRemoteRequestsAccessFromLocal'
  ]);
  user.consent = new consent.State(false);

  user.network = <social.Network><any>jasmine.createSpyObj(
      'network', ['getUser']);

  user['getLocalInstanceId'] = function() {
      return 'localInstanceId';
  }

  user.isInstanceOnline = function() {
    return true;
  };
  user.onceNameReceived = Promise.resolve<string>('name');

  var socksToRtc =
      <socks_to_rtc.SocksToRtc><any>jasmine.createSpyObj('socksToRtc', [
          'onceReady'
      ]);
  var instance :remote_instance.RemoteInstance;
  var localPeerId = {
    clientInstancePath: 'clientInstancePath',
    serverInstancePath: 'serverInstancePath'
  };

  beforeEach(() => {
    spyOn(console, 'log');
    spyOn(console, 'warn');
  });
  describe('storage', () => {
    var realStorage = new local_storage.Storage;
    var instance0 :remote_instance.RemoteInstance;

   it('fresh instance has no state', (done) => {
      globals.storage.save = function(key :string, value :Object) {
        return realStorage.save(key, value);
      };
      instance0 = new remote_instance.RemoteInstance(user, 'instanceId');
      instance0.onceLoaded.then(() => {
        expect(instance0.description).not.toBeDefined();
        done();
      });
    });

    it ('update waits for loading to complete', (done) => {
      instance0.update({
        instanceId : 'newInstanceId', publicKey : 'key', description: 'desc',
        consent: {isRequesting: true, isOffering: true}
      }, constants.MESSAGE_VERSION).then(() => {
        expect(instance0.publicKey).toEqual('key');
        expect(instance0.description).toEqual('desc');
        expect(instance0.wireConsentFromRemote.isOffering).toEqual(true);
        expect(instance0.wireConsentFromRemote.isRequesting).toEqual(true);
      }).then(done);
      expect(instance0.publicKey).not.toBeDefined();
      expect(instance0.description).not.toBeDefined();
      expect(instance0.wireConsentFromRemote.isOffering).toEqual(false);
      expect(instance0.wireConsentFromRemote.isRequesting).toEqual(false);
    })
  });

  describe('updating consent from instance handshake', () => {
    var instance :remote_instance.RemoteInstance;
    var INSTANCE_ID = 'instance1';

    beforeEach((done) => {
      let testStorage = new local_storage.Storage();
      globals.setGlobalStorageForTest(testStorage);
      testStorage.reset().then(() => {
        var network = <social.Network><any>jasmine.createSpyObj(
            'network', ['getUser']);
        network['getStorePath'] = function() { return 'networkPath'; };
        network['getLocalInstanceId'] = function() { return 'myInstanceId'; };
        network['myInstance'] =
            new local_instance.LocalInstance(network, 'localUserId');
        var user = new remote_user.User(network, 'testUser');
        user.update({userId: 'testUser', name: 'Alice'});
        instance = new remote_instance.RemoteInstance(user, INSTANCE_ID);
        user['instances_'][INSTANCE_ID] = instance;
        Promise.all([user.onceLoaded, instance.onceLoaded]).then(done);
      });
    });

    it('copies consent from wire, updates user.remoteRequestsAccessFromLocal',
        (done) => {
      var userConsent = instance.user.consent;
      expect(instance.wireConsentFromRemote.isOffering).toEqual(false);
      expect(instance.wireConsentFromRemote.isRequesting).toEqual(false);
      expect(userConsent.remoteRequestsAccessFromLocal).toEqual(false);
      instance.update({
        instanceId: INSTANCE_ID, description: '', publicKey: '',
        consent: {isOffering: true, isRequesting: true}
      }, constants.MESSAGE_VERSION).then(() => {
        expect(instance.wireConsentFromRemote.isOffering).toEqual(true);
        expect(instance.wireConsentFromRemote.isRequesting).toEqual(true);
        expect(userConsent.remoteRequestsAccessFromLocal).toEqual(true);
        done();
      });
    });
  });

  describe('proxying', () => {
    var alice = new remote_instance.RemoteInstance(user, 'instance-alice');

    var socksToRtc :socks_to_rtc_mock.SocksToRtcMock

    beforeEach(() => {
      socksToRtc = new socks_to_rtc_mock.SocksToRtcMock();
      spyOn(socks_to_rtc, 'SocksToRtc').and.returnValue(socksToRtc);
    });

    it('can start proxying', (done) => {
      var aliceState = alice.currentStateForUi();
      expect(aliceState.localGettingFromRemote).toEqual(social.GettingState.NONE);
      alice.user.consent.localRequestsAccessFromRemote = true;
      alice.wireConsentFromRemote.isOffering = true;
      spyOn(socksToRtc, 'start').and.returnValue(Promise.resolve());

      alice.start().then(() => {
        aliceState = alice.currentStateForUi();
        expect(aliceState.localGettingFromRemote)
            .toEqual(social.GettingState.GETTING_ACCESS);
        done();
      });
      aliceState = alice.currentStateForUi();
      expect(socks_to_rtc.SocksToRtc).toHaveBeenCalled();
      expect(aliceState.localGettingFromRemote)
          .toEqual(social.GettingState.TRYING_TO_GET_ACCESS);
    });

    it('can stop proxying', () => {
      alice.stop();
      var aliceState = alice.currentStateForUi();
      expect(aliceState.localGettingFromRemote).toEqual(social.GettingState.NONE);
    });

    it('refuses to start proxy without permission', () => {
      alice.wireConsentFromRemote.isOffering = false;
      alice.start();
      var aliceState = alice.currentStateForUi();
      expect(aliceState.localGettingFromRemote).toEqual(social.GettingState.NONE);
    });

    // This test no longer passes with the hack to use
    // socksToRtc['onceStopping_'].  Rather than hack this test to pass,
    // we should move socksToRtc to use 'stopped' again, once
    // https://github.com/uProxy/uproxy/issues/1264 is fixed
    //it('stops socksToRtc if start does not complete', (done) => {
    //  jasmine.clock().install();
    //  expect(alice.localGettingFromRemote).toEqual(social.GettingState.NONE);
    //  alice.user.consent.localRequestsAccessFromRemote = true;
    //  alice.wireConsentFromRemote.isOffering = true;
    //  // Mock socksToRtc to not fulfill start promise
    //  spyOn(socks_to_rtc, 'SocksToRtc').and.returnValue({
    //    'start':
    //        (endpoint:net.Endpoint, pcConfig:freedom.RTCPeerConnection.RTCConfiguration) => {
    //       return new Promise((F, R) => {});
    //    },
    //    'on': (t:string, f:Function) => {},
    //    'stop': () => {
    //      done();
    //      return Promise.resolve();
    //    }
    //  });
    //  alice.start();
    //  jasmine.clock().tick(alice.SOCKS_TO_RTC_TIMEOUT + 1);
    //  jasmine.clock().uninstall();
    //});

  });  // describe proxying

  describe('signalling', () => {
    var alice :remote_instance.RemoteInstance;

    var socksToRtc :socks_to_rtc_mock.SocksToRtcMock
    var rtcToNet :rtc_to_net_mock.RtcToNetMock;

    var fakeSignallingMessage :bridge.SignallingMessage = {
      signals: {
        'FAKE': []
      },
      first: true
    };

    beforeEach(() => {
      alice = new remote_instance.RemoteInstance(user, 'instance-alice');
      alice['connection_'].onceSharerCreated = Promise.resolve();

      user.consent.localGrantsAccessToRemote = true;

      socksToRtc = new socks_to_rtc_mock.SocksToRtcMock();
      spyOn(socks_to_rtc, 'SocksToRtc').and.returnValue(socksToRtc);

      rtcToNet = new rtc_to_net_mock.RtcToNetMock();
      spyOn(rtc_to_net, 'RtcToNet').and.returnValue(rtcToNet);

      spyOn(socksToRtc, 'handleSignalFromPeer').and.callThrough();
      spyOn(rtcToNet, 'handleSignalFromPeer').and.callThrough();
    });

    it('handles OFFER signal from client peer as server', (done) => {
      alice.handleSignal({
          type: social.PeerMessageType.SIGNAL_FROM_CLIENT_PEER,
          data: fakeSignallingMessage,
          version: constants.MESSAGE_VERSION
      }).then(() => {
        expect(socksToRtc.handleSignalFromPeer).not.toHaveBeenCalled();
        expect(rtcToNet.handleSignalFromPeer).toHaveBeenCalledWith(
            fakeSignallingMessage);
        done();
      });
    });

    it('handles signal from server peer as client', (done) => {
      alice.wireConsentFromRemote.isOffering = true;
      spyOn(socksToRtc, 'start').and.returnValue(Promise.resolve());

      alice.start().then(() => {
        alice.handleSignal({
            type: social.PeerMessageType.SIGNAL_FROM_SERVER_PEER,
            data: fakeSignallingMessage,
            version: constants.MESSAGE_VERSION
        }).then(() => {
          expect(socksToRtc.handleSignalFromPeer).toHaveBeenCalledWith(
              fakeSignallingMessage);
          expect(rtcToNet.handleSignalFromPeer).not.toHaveBeenCalled();
          done();
        });
      }).catch((e) => console.error('error calling start: ' + e));
    });

    it('rejects invalid signals', (done) => {
      alice.handleSignal({
          type: social.PeerMessageType.INSTANCE,
          data: fakeSignallingMessage,
          version: constants.MESSAGE_VERSION
      }).then(() => {
        expect(rtcToNet.handleSignalFromPeer).not.toHaveBeenCalled();
        expect(socksToRtc.handleSignalFromPeer).not.toHaveBeenCalled();
        done();
      });
    });

    it('rejects message from client if consent has not been granted', (done) => {
      alice.user.consent.localGrantsAccessToRemote = false;
      alice.handleSignal({
          type: social.PeerMessageType.SIGNAL_FROM_CLIENT_PEER,
          data: fakeSignallingMessage,
          version: constants.MESSAGE_VERSION
      }).then(() => {
        expect(socksToRtc.handleSignalFromPeer).not.toHaveBeenCalled();
        expect(rtcToNet.handleSignalFromPeer).not.toHaveBeenCalled();
        done();
      });
    });
  });
});
