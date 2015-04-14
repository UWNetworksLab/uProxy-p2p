/*
 * remote-instance.spec.ts
 *
 * This file ensures that interactions with a remote instance are correct. For
 * instance, sometimes consent between two instances needs to be resolved after
 * they've been disconnected. This must ensure that we resolve the
 * correct consent values between remote instances.
 */
/// <reference path='../../../third_party/typings/jasmine/jasmine.d.ts' />
/// <reference path='../webrtc/peerconnection.d.ts' />
/// <reference path='remote-instance.ts' />

describe('Core.RemoteInstance', () => {

  // Prepare a fake Social.Network object to construct User on top of.
  var user = <Core.User><any>jasmine.createSpyObj('user', [
      'send',
      'notifyUI',
      'instanceToClient',
      'sendInstanceHandshake',
      'updateRemoteRequestsAccessFromLocal'
  ]);
  user.consent = new Consent.State();

  user.network = <Social.Network><any>jasmine.createSpyObj(
      'network', ['getUser']);

  user['getLocalInstanceId'] = function() {
      return 'localInstanceId';
  }

  user.isInstanceOnline = function() {
    return true;
  };
  user.onceNameReceived = Promise.resolve<string>("name");

  var socksToRtc =
      <SocksToRtc.SocksToRtc><any>jasmine.createSpyObj('socksToRtc', [
          'onceReady'
      ]);
  var instance :Core.RemoteInstance;
  var localPeerId = {
    clientInstancePath: 'clientInstancePath',
    serverInstancePath: 'serverInstancePath'
  };

  beforeEach(() => {
    spyOn(console, 'log');
    spyOn(console, 'warn');
  });
  describe('storage', () => {
    var realStorage = new Core.Storage;
    var saved;
    var instance0;

   it('fresh instance has no state', (done) => {
      storage.save = function(key, value) {
        saved = realStorage.save(key, value);
        return saved;
      };
      instance0 = new Core.RemoteInstance(user, 'instanceId');
      instance0.onceLoaded.then(() => {
        expect(instance0.description).not.toBeDefined();
        expect(instance0.keyHash).not.toBeDefined();
        done();
      });
    });

    it ('update waits for loading to complete', (done) => {
      instance0.update({
        instanceId : 'newInstanceId', keyHash : 'key', description: 'desc',
        consent: {isRequesting: true, isOffering: true}
      }).then(() => {
        expect(instance0.keyHash).toEqual('key');
        expect(instance0.description).toEqual('desc');
        expect(instance0.wireConsentFromRemote.isOffering).toEqual(true);
        expect(instance0.wireConsentFromRemote.isRequesting).toEqual(true);
      }).then(done);
      expect(instance0.keyHash).not.toBeDefined();
      expect(instance0.description).not.toBeDefined();
      expect(instance0.wireConsentFromRemote.isOffering).toEqual(false);
      expect(instance0.wireConsentFromRemote.isRequesting).toEqual(false);
    })
  });

  describe('updating consent from instance handshake', () => {
    var instance :Core.RemoteInstance;
    var INSTANCE_ID = 'instance1';

    beforeEach((done) => {
      storage = new Core.Storage;
      storage.reset().then(() => {
        var network = <Social.Network><any>jasmine.createSpyObj(
            'network', ['getUser']);
        network['getStorePath'] = function() { return 'networkPath'; };
        network['getLocalInstanceId'] = function() { return 'myInstanceId'; };
        var user = new Core.User(network, 'testUser');
        user.update({userId: 'testUser', name: 'Alice'});
        instance = new Core.RemoteInstance(user, INSTANCE_ID);
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
        instanceId: INSTANCE_ID, description: '', keyHash: '',
        consent: {isOffering: true, isRequesting: true}
      }).then(() => {
        expect(instance.wireConsentFromRemote.isOffering).toEqual(true);
        expect(instance.wireConsentFromRemote.isRequesting).toEqual(true);
        expect(userConsent.remoteRequestsAccessFromLocal).toEqual(true);
        done();
      });
    });
  });

  describe('proxying', () => {

    var alice = new Core.RemoteInstance(user, 'instance-alice');

    // Bare-minimum functions to fake the current version methods of SocksToRtc.
    // TODO once using uproxy-lib v20+, move to real mocks (examples:
    // https://github.com/uProxy/uproxy-lib/blob/dev/src/freedom/mocks/mock-eventhandler.ts
    // https://github.com/uProxy/uproxy-lib/blob/dev/src/webrtc/peerconnection.spec.ts
    // )
    var fakeSocksToRtc = {
      handlers: {},
      'start':
          (endpoint:Net.Endpoint, pcConfig: freedom_RTCPeerConnection.RTCConfiguration) => {
         return Promise.resolve(endpoint);
      },
      'on': (t:string, f:Function) => { fakeSocksToRtc.handlers[t] = f; },
      'stop': () => {
        if (typeof fakeSocksToRtc.handlers['stopped'] === 'function') {
          fakeSocksToRtc.handlers['stopped']();
        }
        return Promise.resolve();
      }
    };

    it('can start proxying', (done) => {
      expect(alice.localGettingFromRemote).toEqual(GettingState.NONE);
      alice.user.consent.localRequestsAccessFromRemote = true;
      alice.wireConsentFromRemote.isOffering = true;
      // The module & constructor of SocksToRtc may change in the near future.
      spyOn(SocksToRtc, 'SocksToRtc').and.returnValue(fakeSocksToRtc);
      alice.start().then(() => {
        expect(alice.localGettingFromRemote)
            .toEqual(GettingState.GETTING_ACCESS);
        done();
      });
      expect(SocksToRtc.SocksToRtc).toHaveBeenCalled();
      expect(alice.localGettingFromRemote)
          .toEqual(GettingState.TRYING_TO_GET_ACCESS);
    });

    it('can stop proxying', () => {
      alice.stop();
      expect(alice.localGettingFromRemote).toEqual(GettingState.NONE);
    });

    it('refuses to start proxy without permission', () => {
      spyOn(SocksToRtc, 'SocksToRtc').and.returnValue(fakeSocksToRtc);
      alice.wireConsentFromRemote.isOffering = false;
      alice.localGettingFromRemote = GettingState.NONE;
      alice.start();
      expect(alice.localGettingFromRemote).toEqual(GettingState.NONE);
    });

    it('stops socksToRtc if start does not complete', (done) => {
      jasmine.clock().install();
      expect(alice.localGettingFromRemote).toEqual(GettingState.NONE);
      alice.user.consent.localRequestsAccessFromRemote = true;
      alice.wireConsentFromRemote.isOffering = true;
      // Mock socksToRtc to not fulfill start promise
      spyOn(SocksToRtc, 'SocksToRtc').and.returnValue({
        'start':
            (endpoint:Net.Endpoint, pcConfig:freedom_RTCPeerConnection.RTCConfiguration) => {
           return new Promise((F, R) => {});
        },
        'on': (t:string, f:Function) => {},
        'stop': () => {
          done();
          return Promise.resolve();
        }
      });
      alice.start();
      jasmine.clock().tick(alice.SOCKS_TO_RTC_TIMEOUT + 1);
      jasmine.clock().uninstall();
    });

  });  // describe proxying

  describe('signalling', () => {

    // Build a mock Alice with fake signals and networking hooks.
    var alice :Core.RemoteInstance;  // Reset before each test in beforeEach
    var fakeSocksToRtc = {
      'handleSignalFromPeer': () => {},
      'on': () => {},
      'start': () => { return Promise.resolve(); },
      'stop': () => { return Promise.resolve(); }
    };
    var fakeRtcToNet = {
      'handleSignalFromPeer': () => {},
      'onceClosed': new Promise((F, R) => {}),  // return unresolved promise
      'signalsForPeer': {setSyncHandler: () => {}},
      'bytesReceivedFromPeer': {setSyncHandler: () => {}},
      'bytesSentToPeer': {setSyncHandler: () => {}},
      'onceReady': new Promise((F, R) => {})  // return unresolved promise
    };
    var fakeOffer :Object = {
      type: WebRtc.SignalType.OFFER,
      data: 'really fake offer'
    };
    var fakeCandidate :Object = {
      type: WebRtc.SignalType.CANDIDATE,
      data: 'really fake candidate'
    };

    beforeEach(() => {
      alice = new Core.RemoteInstance(user, 'instance-alice');
      user.consent.localGrantsAccessToRemote = true;
      spyOn(fakeSocksToRtc, 'handleSignalFromPeer');
      spyOn(fakeRtcToNet, 'handleSignalFromPeer');
      spyOn(SocksToRtc, 'SocksToRtc').and.returnValue(fakeSocksToRtc);
      spyOn(RtcToNet, 'RtcToNet').and.returnValue(fakeRtcToNet);
    });

    it('ignores CANDIDATE signal from client peer as server without OFFER', (done) => {
      alice.handleSignal(uProxy.MessageType.SIGNAL_FROM_CLIENT_PEER, fakeCandidate).then(() => {
        expect(fakeSocksToRtc.handleSignalFromPeer).not.toHaveBeenCalled();
        expect(fakeRtcToNet.handleSignalFromPeer).not.toHaveBeenCalled();
        done();
      });
    });

    it('handles OFFER signal from client peer as server', (done) => {
      alice.handleSignal(uProxy.MessageType.SIGNAL_FROM_CLIENT_PEER, fakeOffer).then(() => {
        expect(fakeSocksToRtc.handleSignalFromPeer).not.toHaveBeenCalled();
        expect(fakeRtcToNet.handleSignalFromPeer).toHaveBeenCalledWith(fakeOffer);
        done();
      });
    });

    it('handles signal from server peer as client', (done) => {
      alice.wireConsentFromRemote.isOffering = true;
      alice.start().then(() => {
        alice.handleSignal(uProxy.MessageType.SIGNAL_FROM_SERVER_PEER, fakeCandidate).then(() => {
          expect(fakeSocksToRtc.handleSignalFromPeer).toHaveBeenCalledWith(fakeCandidate);
          expect(fakeRtcToNet.handleSignalFromPeer).not.toHaveBeenCalled();
          done();
        });
      }).catch((e) => console.error('error calling start: ' + e));
    });

    it('rejects invalid signals', (done) => {
      alice.handleSignal(uProxy.MessageType.INSTANCE, fakeCandidate).then(() => {
        expect(fakeRtcToNet.handleSignalFromPeer).not.toHaveBeenCalled();
        expect(fakeSocksToRtc.handleSignalFromPeer).not.toHaveBeenCalled();
        done();
      });
    });

    it('rejects message from client if consent has not been granted', (done) => {
      alice.user.consent.localGrantsAccessToRemote = false;
      alice.handleSignal(uProxy.MessageType.SIGNAL_FROM_CLIENT_PEER, fakeCandidate).then(() => {
        expect(fakeSocksToRtc.handleSignalFromPeer).not.toHaveBeenCalled();
        expect(fakeRtcToNet.handleSignalFromPeer).not.toHaveBeenCalled();
        done();
      });
    });
  });
});
