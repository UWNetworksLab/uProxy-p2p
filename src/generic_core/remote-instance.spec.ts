/*
 * remote-instance.spec.ts
 *
 * This file ensures that interactions with a remote instance are correct. For
 * instance, sometimes consent between two instances needs to be resolved after
 * they've been disconnected. This must ensure that we resolve the
 * correct consent values between remote instances.
 */
/// <reference path='../../../third_party/typings/jasmine/jasmine.d.ts' />

import remote_user = require('./remote-user');
import consent = require('./consent');
import remote_instance = require('./remote-instance');
import social = require('../interfaces/social');
import socks_to_rtc = require('../../../third_party/uproxy-lib/socks-to-rtc/socks-to-rtc');
import rtc_to_net = require('../../../third_party/uproxy-lib/rtc-to-net/rtc-to-net');
import globals = require('./globals');
import local_storage = require('./storage');
import net = require('../../../third_party/uproxy-lib/net/net.types');
import local_instance = require('./local-instance');
import bridge = require('../../../third_party/uproxy-lib/bridge/bridge');


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
  user.onceNameReceived = Promise.resolve<string>("name");

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
        consent: {isRequesting: true, isOffering: true},
        name: 'name', userId: 'userId'
      }, globals.MESSAGE_VERSION).then(() => {
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
      globals.storage = new local_storage.Storage();
      globals.storage.reset().then(() => {
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
        consent: {isOffering: true, isRequesting: true},
        name: 'name', userId: 'userId'
      }, globals.MESSAGE_VERSION).then(() => {
        expect(instance.wireConsentFromRemote.isOffering).toEqual(true);
        expect(instance.wireConsentFromRemote.isRequesting).toEqual(true);
        expect(userConsent.remoteRequestsAccessFromLocal).toEqual(true);
        done();
      });
    });
  });

  describe('proxying', () => {

    var alice = new remote_instance.RemoteInstance(user, 'instance-alice');

    // Bare-minimum functions to fake the current version methods of SocksToRtc.
    // TODO once using uproxy-lib v20+, move to real mocks (examples:
    // https://github.com/uProxy/uproxy-lib/blob/dev/src/freedom/mocks/mock-eventhandler.ts
    // https://github.com/uProxy/uproxy-lib/blob/dev/src/webrtc/peerconnection.spec.ts
    // )
    var fakeSocksToRtc = {
      handlers: <{[key :string] :Function}>{},
      'start':
          (endpoint:net.Endpoint, pcConfig: freedom.RTCPeerConnection.RTCConfiguration) => {
         return Promise.resolve(endpoint);
      },
      'on': (t:string, f:Function) => { fakeSocksToRtc.handlers[t] = f; },
      'stop': () => {
        if (typeof fakeSocksToRtc.handlers['stopped'] === 'function') {
          fakeSocksToRtc.handlers['stopped']();
        }
        return Promise.resolve();
      },
      // TODO: remove onceStopping_ when
      // https://github.com/uProxy/uproxy/issues/1264 is resolved.
      'onceStopping_': new Promise((F, R) => {}),
      'handleSignalFromPeer': () => {}
    };

    it('can start proxying', (done) => {
      var aliceState = alice.currentStateForUi();
      expect(aliceState.localGettingFromRemote).toEqual(social.GettingState.NONE);
      alice.user.consent.localRequestsAccessFromRemote = true;
      alice.wireConsentFromRemote.isOffering = true;
      // The module & constructor of SocksToRtc may change in the near future.
      spyOn(socks_to_rtc, 'SocksToRtc').and.returnValue(fakeSocksToRtc);
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
      spyOn(socks_to_rtc, 'SocksToRtc').and.returnValue(fakeSocksToRtc);
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

    // Build a mock Alice with fake signals and networking hooks.
    var alice :remote_instance.RemoteInstance;  // Reset before each test in beforeEach
    var fakeSocksToRtc = {
      'handleSignalFromPeer': () => {},
      'on': () => {},
      'start': () => { return Promise.resolve(); },
      'stop': () => { return Promise.resolve(); },
      // TODO: remove onceStopping_ when
      // https://github.com/uProxy/uproxy/issues/1264 is resolved.
      'onceStopping_': new Promise((F, R) => {}),
    };
    var fakeRtcToNet = {
      'handleSignalFromPeer': () => {},
      'onceStopped': new Promise((F, R) => {}),  // return unresolved promise
      'signalsForPeer': {setSyncHandler: () => {}},
      'bytesReceivedFromPeer': {setSyncHandler: () => {}},
      'bytesSentToPeer': {setSyncHandler: () => {}},
      'onceReady': new Promise((F, R) => {}),  // return unresolved promise
      'start': () => {}
    };
    var fakeSignallingMessage :bridge.SignallingMessage = {
      signals: {
        'FAKE': []
      },
      first: true
    };

    beforeEach(() => {
      alice = new remote_instance.RemoteInstance(user, 'instance-alice');
      user.consent.localGrantsAccessToRemote = true;
      spyOn(fakeSocksToRtc, 'handleSignalFromPeer');
      spyOn(fakeRtcToNet, 'handleSignalFromPeer');
      spyOn(socks_to_rtc, 'SocksToRtc').and.returnValue(fakeSocksToRtc);
      spyOn(rtc_to_net, 'RtcToNet').and.returnValue(fakeRtcToNet);
      alice['connection_'].onceSharerCreated = Promise.resolve<void>();
    });

    it('handles OFFER signal from client peer as server', (done) => {
      alice.handleSignal({
          type: social.PeerMessageType.SIGNAL_FROM_CLIENT_PEER,
          data: fakeSignallingMessage,
          version: globals.MESSAGE_VERSION}).then(() => {
        expect(fakeSocksToRtc.handleSignalFromPeer).not.toHaveBeenCalled();
        expect(fakeRtcToNet.handleSignalFromPeer).toHaveBeenCalledWith(
            fakeSignallingMessage);
        done();
      });
    });

    it('handles signal from server peer as client', (done) => {
      alice.wireConsentFromRemote.isOffering = true;
      alice.start().then(() => {
        alice.handleSignal({
            type: social.PeerMessageType.SIGNAL_FROM_SERVER_PEER,
            data: fakeSignallingMessage,
            version: globals.MESSAGE_VERSION}).then(() => {
          expect(fakeSocksToRtc.handleSignalFromPeer).toHaveBeenCalledWith(
              fakeSignallingMessage);
          expect(fakeRtcToNet.handleSignalFromPeer).not.toHaveBeenCalled();
          done();
        });
      }).catch((e) => console.error('error calling start: ' + e));
    });

    it('rejects invalid signals', (done) => {
      alice.handleSignal({
          type: social.PeerMessageType.INSTANCE,
          data: fakeSignallingMessage,
          version: globals.MESSAGE_VERSION}).then(() => {
        expect(fakeRtcToNet.handleSignalFromPeer).not.toHaveBeenCalled();
        expect(fakeSocksToRtc.handleSignalFromPeer).not.toHaveBeenCalled();
        done();
      });
    });

    it('rejects message from client if consent has not been granted', (done) => {
      alice.user.consent.localGrantsAccessToRemote = false;
      alice.handleSignal({
          type: social.PeerMessageType.SIGNAL_FROM_CLIENT_PEER,
          data: fakeSignallingMessage,
          version: globals.MESSAGE_VERSION}).then(() => {
        expect(fakeSocksToRtc.handleSignalFromPeer).not.toHaveBeenCalled();
        expect(fakeRtcToNet.handleSignalFromPeer).not.toHaveBeenCalled();
        done();
      });
    });
  });
});
