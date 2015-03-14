/*
 * remote-instance.spec.ts
 *
 * This file ensures that interactions with a remote instance are correct. For
 * instance, sometimes consent between two instances needs to be resolved after
 * they've been disconnected. This must ensure that we resolve the
 * correct consent values between remote instances.
 */
/// <reference path='../third_party/typings/jasmine/jasmine.d.ts' />
/// <reference path='../webrtc/peerconnection.d.ts' />
/// <reference path='remote-instance.ts' />

describe('Core.RemoteInstance', () => {

  // Prepare a fake Social.Network object to construct User on top of.
  var user = <Core.User><any>jasmine.createSpyObj('user', [
      'send',
      'notifyUI',
      'instanceToClient',
      'sendInstanceHandshake',
  ]);
  user.consent = new Consent.State;

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

   // TODO: make this pass
    // it ('update waits for loading to complete', (done) => {
    //   // storage.load = function(key) {
    //   //   var delay = new Promise((F, R) => {
    //   //     fulfill = F;
    //   //   });
    //   //   return delay.then(() => {
    //   //     return realStorage.load(instance0.getStorePath());
    //   //   });
    //   // }
    //   // var instance2 = new Core.RemoteInstance(user, 'newInstanceId');
    //   instance0.update({
    //     instanceId : 'newInstanceId', keyHash : 'key', description: 'desc',
    //     consent: {isRequesting: true, isOffering: true}
    //   }).then(() => {
    //     console.error('11111');
    //     expect(instance0.keyHash).toEqual('key');
    //     expect(instance0.description).toEqual('desc');
    //     expect(instance0.wireConsentFromRemote.isOffering).toEqual(true);
    //     expect(instance0.wireConsentFromRemote.isRequesting).toEqual(true);
    //     // storage = new Core.Storage;
    //   }).then(done);
    //   expect(instance0.keyHash).not.toBeDefined();
    //   expect(instance0.description).not.toBeDefined();
    //   expect(instance0.wireConsentFromRemote.isOffering).toEqual(false);
    //   expect(instance0.wireConsentFromRemote.isRequesting).toEqual(false);
    //   // instance2['fulfillStorageLoad_']();
    // })
  });

  describe('updating consent', () => {
    // TODO(dborkan): add tests here
  });

  describe('proxying', () => {

    var alice = new Core.RemoteInstance(user, 'instance-alice');
    // TODO: test that this doesn't have async issues
    alice.update({
      instanceId: 'instance-alice',
      keyHash:    'fake-hash-alice',
      description: 'alice peer',
      consent: {isOffering: false, isRequesting: false}
    });

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
      console.log(JSON.stringify(SocksToRtc));
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

    it('ignores CANDIDATE signal from client peer as server without OFFER', () => {
      alice.handleSignal(uProxy.MessageType.SIGNAL_FROM_CLIENT_PEER, fakeCandidate);
      expect(fakeSocksToRtc.handleSignalFromPeer).not.toHaveBeenCalled();
      expect(fakeRtcToNet.handleSignalFromPeer).not.toHaveBeenCalled();
    });

    it('handles OFFER signal from client peer as server', () => {
      alice.handleSignal(uProxy.MessageType.SIGNAL_FROM_CLIENT_PEER, fakeOffer);
      expect(fakeSocksToRtc.handleSignalFromPeer).not.toHaveBeenCalled();
      expect(fakeRtcToNet.handleSignalFromPeer).toHaveBeenCalledWith(fakeOffer);
    });

    it('handles signal from server peer as client', (done) => {
      alice.wireConsentFromRemote.isOffering = true;
      alice.start().then(() => {
        alice.handleSignal(uProxy.MessageType.SIGNAL_FROM_SERVER_PEER, fakeCandidate);
        expect(fakeSocksToRtc.handleSignalFromPeer).toHaveBeenCalledWith(fakeCandidate);
        expect(fakeRtcToNet.handleSignalFromPeer).not.toHaveBeenCalled();
        done();
      }).catch((e) => console.error('error calling start: ' + e));
    });

    it('rejects invalid signals', () => {
      alice.handleSignal(uProxy.MessageType.INSTANCE, fakeCandidate);
      expect(fakeRtcToNet.handleSignalFromPeer).not.toHaveBeenCalled();
      expect(fakeSocksToRtc.handleSignalFromPeer).not.toHaveBeenCalled();
    });

    it('rejects message from client if consent has not been granted', () => {
      alice.user.consent.localGrantsAccessToRemote = false;
      alice.handleSignal(uProxy.MessageType.SIGNAL_FROM_CLIENT_PEER, fakeCandidate);
      expect(fakeSocksToRtc.handleSignalFromPeer).not.toHaveBeenCalled();
      expect(fakeRtcToNet.handleSignalFromPeer).not.toHaveBeenCalled();
    });
  });
});
