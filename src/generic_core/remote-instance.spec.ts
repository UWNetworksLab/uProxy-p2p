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
      'sendInstanceHandshake'
  ]);

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
      instance0 = new Core.RemoteInstance(user, 'instanceId', null);
      instance0.onceLoaded.then(() => {
        expect(instance0.description).not.toBeDefined();
        expect(instance0.keyHash).not.toBeDefined();
        expect(instance0.consent).toEqual(new Consent.State);
        done();
      });
    });

    it('update', (done) => {
      var handshake :InstanceHandshake = {
        instanceId : 'instanceId',
        keyHash : 'dummy-keyhash',
        description: 'home computer'
      };
      spyOn(instance0, 'sendConsent');
      instance0.update(handshake);
      instance0.modifyConsent(uProxy.ConsentUserAction.REQUEST);

      instance0.onceLoaded.then(() => {
        expect(saved).toBeDefined();
        saved.then(() => {
          var newInstance = new Core.RemoteInstance(user, 'instanceId', null);
          newInstance.onceLoaded.then(() => {
            expect(newInstance.currentState()).toEqual(instance0.currentState());
            done();
          });
        });
      });
    });

    it ('delay loading', (done) => {
      var fulfill;
      storage.load = function(key) {
        var delay = new Promise((F, R) => {
          fulfill = F;
        });
        return delay.then(() => {
          return realStorage.load(instance0.getStorePath());
        });
      }

      var handshake :InstanceHandshake = {
        instanceId : 'instanceId',
        keyHash : 'new-keyhash',
        description: 'new description'
      };
      var instance2 = new Core.RemoteInstance(user, 'instanceId', handshake);
      var consent :uProxy.ConsentWireState = {
        isRequesting: true,
        isOffering: true,
      };
      instance2.updateConsent(consent);
      instance2.onceLoaded.then(() => {
        instance2.description = 'new description';
        expect(instance2.consent.remoteRequestsAccessFromLocal).toEqual(true);
        expect(instance2.consent.remoteGrantsAccessToLocal).toEqual(true);
        storage = new Core.Storage;
      }).then(done);
      fulfill();
    })
  });

  it('constructs from a received Instance Handshake', (done) => {
    var handshake :Instance = {
      instanceId: 'fakeinstance',
      keyHash:    'fakehash',
      description: 'totally fake',
    }
    instance = new Core.RemoteInstance(user, 'fakeinstance', handshake);
    expect(instance.instanceId).toEqual('fakeinstance');
    done();
  });

  it('begins with lowest consent bits', () => {
    var emptyConsent = new Consent.State();
    expect(instance.consent).toEqual(emptyConsent);
  });

  it('modifying consent locally also sends consent bits to remote', () => {
    spyOn(instance, 'sendConsent');
    instance.modifyConsent(uProxy.ConsentUserAction.REQUEST);
    expect(instance.sendConsent).toHaveBeenCalled();
  });

  it('does not send consent for invalid modification', () => {
    spyOn(instance, 'sendConsent');
    instance.modifyConsent(<uProxy.ConsentUserAction>-1);
    expect(instance.sendConsent).not.toHaveBeenCalled();
  });

  describe('local consent towards remote proxy', () => {

    beforeEach(() => {
      spyOn(instance, 'sendConsent');
    });

    it('can request access, and cancel that request', () => {
      instance.modifyConsent(uProxy.ConsentUserAction.REQUEST);
      expect(instance.consent.localRequestsAccessFromRemote).toEqual(true);
      instance.modifyConsent(uProxy.ConsentUserAction.CANCEL_REQUEST);
      expect(instance.consent.localRequestsAccessFromRemote).toEqual(false);
    });

    it('accepts offer from remote', () => {
      instance.consent.remoteGrantsAccessToLocal = true;
      instance.modifyConsent(uProxy.ConsentUserAction.REQUEST);
      expect(instance.consent.remoteGrantsAccessToLocal).toEqual(true);
      expect(instance.consent.localRequestsAccessFromRemote).toEqual(true);
    });

    it('ignores offer from remote', () => {
      instance.consent.remoteGrantsAccessToLocal = true;
      instance.modifyConsent(uProxy.ConsentUserAction.IGNORE_OFFER);
      expect(instance.consent.ignoringRemoteUserOffer).toEqual(true);
    });

    it('can re-accept even after ignoring', () => {
      instance.modifyConsent(uProxy.ConsentUserAction.REQUEST);
      expect(instance.consent.remoteGrantsAccessToLocal).toEqual(true);
      expect(instance.consent.localRequestsAccessFromRemote).toEqual(true);
    });

    it('cancelling after granted still keeps remote offer', () => {
      instance.modifyConsent(uProxy.ConsentUserAction.CANCEL_REQUEST);
      expect(instance.consent.remoteGrantsAccessToLocal).toEqual(true);
    });

    it('ignore-offers bit reset after requesting', () => {
      instance.consent.localRequestsAccessFromRemote = false;
      instance.modifyConsent(uProxy.ConsentUserAction.IGNORE_OFFER);
      expect(instance.consent.ignoringRemoteUserOffer).toEqual(true);
      instance.modifyConsent(uProxy.ConsentUserAction.REQUEST);
      expect(instance.consent.localRequestsAccessFromRemote).toEqual(true);
      expect(instance.consent.ignoringRemoteUserOffer).toEqual(false);
    });

    afterEach(() => {
      expect(instance.sendConsent).toHaveBeenCalled();
    });

    it('invalid proxy transitions do not modify consent', () => {
      var emptyConsent = new Consent.State();

      instance.consent = new Consent.State();
      instance.modifyConsent(uProxy.ConsentUserAction.CANCEL_REQUEST);
      expect(instance.consent).toEqual(emptyConsent);
      instance.modifyConsent(uProxy.ConsentUserAction.UNIGNORE_OFFER);
      expect(instance.consent).toEqual(emptyConsent);
      // proxy consent modifications did not touch client consent
      expect(instance.consent.localRequestsAccessFromRemote).toEqual(false);
    });
  });

  describe('local consent towards remote client', () => {

    beforeEach(() => {
      spyOn(instance, 'sendConsent');
    });

    it('can offer access, and cancel that offer', () => {
      instance.modifyConsent(uProxy.ConsentUserAction.OFFER);
      expect(instance.consent.localGrantsAccessToRemote).toEqual(true);
      instance.modifyConsent(uProxy.ConsentUserAction.CANCEL_OFFER);
      expect(instance.consent.localGrantsAccessToRemote).toEqual(false);
    });

    it('allows request from remote', () => {
      instance.consent.localGrantsAccessToRemote = false;
      instance.modifyConsent(uProxy.ConsentUserAction.OFFER);
      expect(instance.consent.localGrantsAccessToRemote).toEqual(true);
    });

    it('ignores request from remote', () => {
      instance.consent.remoteRequestsAccessFromLocal = true;
      instance.consent.ignoringRemoteUserRequest = false;
      instance.modifyConsent(uProxy.ConsentUserAction.IGNORE_REQUEST);
      expect(instance.consent.remoteRequestsAccessFromLocal).toEqual(true);
      expect(instance.consent.ignoringRemoteUserRequest).toEqual(true);
    });

    it('can re-accept even after ignoring', () => {
      instance.modifyConsent(uProxy.ConsentUserAction.OFFER);
      expect(instance.consent.localGrantsAccessToRemote).toEqual(true);
    });

    it('cancelling after granted returns to remote offer', () => {
      instance.modifyConsent(uProxy.ConsentUserAction.CANCEL_OFFER);
      expect(instance.consent.localGrantsAccessToRemote).toEqual(false);
      expect(instance.consent.remoteRequestsAccessFromLocal).toEqual(true);
    });

    it('ignore-requests bit reset after granting', () => {
      instance.consent.localGrantsAccessToRemote = false;
      instance.modifyConsent(uProxy.ConsentUserAction.IGNORE_REQUEST);
      expect(instance.consent.ignoringRemoteUserRequest).toEqual(true);
      instance.modifyConsent(uProxy.ConsentUserAction.OFFER);
      expect(instance.consent.localGrantsAccessToRemote).toEqual(true);
      expect(instance.consent.ignoringRemoteUserRequest).toEqual(false);
    });

    afterEach(() => {
      expect(instance.sendConsent).toHaveBeenCalled();
    });

    it('invalid client transitions do not modify consent', () => {
      var emptyConsent = new Consent.State();

      instance.consent = new Consent.State();
      instance.modifyConsent(uProxy.ConsentUserAction.CANCEL_OFFER);
      expect(instance.consent).toEqual(emptyConsent);
      instance.modifyConsent(uProxy.ConsentUserAction.UNIGNORE_REQUEST);
      expect(instance.consent).toEqual(emptyConsent);

      // Client consent modifications did not touch proxy consent
      expect(instance.consent.localGrantsAccessToRemote).toEqual(false);
    });
  });

  describe('receiving consent bits', () => {

    beforeEach(() => {
      // spyOn(user, 'notifyUI');
    });

    it('remote maintains no consent', () => {
      instance.consent = new Consent.State();
      instance.updateConsent({
        isRequesting: false,
        isOffering:   false
      });
      expect(instance.consent).toEqual(new Consent.State());
    });

    it('remote cancels their consent', (done) => {
      instance.consent.remoteRequestsAccessFromLocal = true;
      instance.consent.remoteGrantsAccessToLocal = true;
      instance.updateConsent({
        isRequesting: false,
        isOffering:   false
      });
      instance.onceLoaded.then(() => {
        expect(instance.consent.remoteRequestsAccessFromLocal).toEqual(false);
        expect(instance.consent.remoteGrantsAccessToLocal).toEqual(false);
        done();
      });
    });

    it('remote gives consent', (done) => {
      instance.consent.remoteRequestsAccessFromLocal = false;
      instance.consent.remoteGrantsAccessToLocal = false;
      instance.updateConsent({
        isRequesting: true,
        isOffering:   true
      });
      instance.onceLoaded.then(() => {
        expect(instance.consent.remoteRequestsAccessFromLocal).toEqual(true);
        expect(instance.consent.remoteGrantsAccessToLocal).toEqual(true);
        done();
      });
    });

    it('receiving consent bits sends update to UI', (done) => {
      instance.consent = new Consent.State();
      instance.updateConsent({
        isRequesting: false,
        isOffering:   false
      });
      instance.onceLoaded.then(() => {
        expect(user.notifyUI).toHaveBeenCalled();
        done();
      });
    });

  });

  describe('preparing consent bits to send over the wire', () => {

    it('proxy states whilst user is not requesting', () => {
      instance.consent = new Consent.State();
      expect(instance.getConsentBits().isRequesting).toEqual(false);
      instance.consent.remoteGrantsAccessToLocal = true;
      expect(instance.getConsentBits().isRequesting).toEqual(false);
      instance.consent.ignoringRemoteUserOffer;
      expect(instance.getConsentBits().isRequesting).toEqual(false);
    });

    it('proxy states whilst user is requesting', () => {
      instance.consent = new Consent.State();
      expect(instance.getConsentBits().isRequesting).toEqual(false);
      instance.consent.localRequestsAccessFromRemote = true;
      expect(instance.getConsentBits().isRequesting).toEqual(true);
      instance.consent.remoteGrantsAccessToLocal = true;
      expect(instance.getConsentBits().isRequesting).toEqual(true);
    });

    it('client states whilst user is not offering', () => {
      instance.consent = new Consent.State();
      expect(instance.getConsentBits().isOffering).toEqual(false);
      instance.consent.remoteRequestsAccessFromLocal = true;
      expect(instance.getConsentBits().isOffering).toEqual(false);
      instance.consent.ignoringRemoteUserRequest = true;
      expect(instance.getConsentBits().isOffering).toEqual(false);
    });

    it('client states whilst user is offering', () => {
      instance.consent = new Consent.State();
      expect(instance.getConsentBits().isOffering).toEqual(false);
      instance.consent.localGrantsAccessToRemote = true;
      expect(instance.getConsentBits().isOffering).toEqual(true);
      instance.consent.remoteRequestsAccessFromLocal = true;
      expect(instance.getConsentBits().isOffering).toEqual(true);
    });

  });

  it('two remote instances establish mutual consent', (done) => {
    (<any>user.instanceToClient).and.callFake((instanceId) => {
      return instanceId;
    });

    var alice = new Core.RemoteInstance(user, 'instanceId-alice', {
      instanceId: 'instanceId-alice',
      keyHash:    'fake-hash-alice',
      description: 'alice peer',
    });
    var bob = new Core.RemoteInstance(user, 'instanceId-bob', {
      instanceId: 'instanceId-bob',
      keyHash:    'fake-hash-bob',
      description: 'alice peer',
    });

    (<any>user.sendInstanceHandshake).and.callFake((clientId, consent) => {
      if (clientId === 'instanceId-alice') {
        bob.updateConsent(consent);
      } else if (clientId === 'instanceId-bob') {
        alice.updateConsent(consent);
      }
    });

    // Alice wants to proxy through Bob.
    alice.modifyConsent(uProxy.ConsentUserAction.REQUEST);
    Promise.all([alice.onceLoaded, bob.onceLoaded]).then(() => {
      expect(alice.consent.localRequestsAccessFromRemote).toEqual(true);
      expect(alice.consent.remoteGrantsAccessToLocal).toEqual(false);
      expect(bob.consent.remoteRequestsAccessFromLocal).toEqual(true);
      expect(bob.consent.localGrantsAccessToRemote).toEqual(false);
      // Bob accepts / offers
      bob.modifyConsent(uProxy.ConsentUserAction.OFFER);
      Promise.all([alice.onceLoaded, bob.onceLoaded]).then(() => {
        expect(alice.consent.remoteGrantsAccessToLocal).toEqual(true);
        expect(bob.consent.localGrantsAccessToRemote).toEqual(true);
        done()
      });
    });
  });

  describe('proxying', () => {

    var alice = new Core.RemoteInstance(user, 'instance-alice', {
      instanceId: 'instance-alice',
      keyHash:    'fake-hash-alice',
      description: 'alice peer',
      bytesSent: 0,
      bytesReceived: 0
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
      alice.consent.localRequestsAccessFromRemote = true;
      alice.consent.remoteGrantsAccessToLocal = true;
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
      alice.consent = new Consent.State();
      alice.localGettingFromRemote = GettingState.NONE;
      alice.start();
      expect(alice.localGettingFromRemote).toEqual(GettingState.NONE);
    });

    it('does not stop proxying when already stopped', () => {
      alice.stop();
      expect(alice.localGettingFromRemote).toEqual(GettingState.NONE);
    });

    it('stops socksToRtc if start does not complete', (done) => {
      jasmine.clock().install();
      expect(alice.localGettingFromRemote).toEqual(GettingState.NONE);
      alice.consent.localRequestsAccessFromRemote = true;
      alice.consent.remoteGrantsAccessToLocal = true;
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

    beforeEach((done) => {
      alice = new Core.RemoteInstance(user, 'instance-alice', {
        instanceId: 'instance-alice',
        keyHash:    'fake-hash-alice',
        description: 'alice peer',
      });
      spyOn(fakeSocksToRtc, 'handleSignalFromPeer');
      spyOn(fakeRtcToNet, 'handleSignalFromPeer');
      spyOn(SocksToRtc, 'SocksToRtc').and.returnValue(fakeSocksToRtc);
      spyOn(RtcToNet, 'RtcToNet').and.returnValue(fakeRtcToNet);
      alice.onceLoaded.then(() => {
        alice.consent.localGrantsAccessToRemote = true;
        done();
      });
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
      alice.consent.remoteGrantsAccessToLocal = true;
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
      alice.consent.localGrantsAccessToRemote = false;
      alice.handleSignal(uProxy.MessageType.SIGNAL_FROM_CLIENT_PEER, fakeCandidate);
      expect(fakeSocksToRtc.handleSignalFromPeer).not.toHaveBeenCalled();
      expect(fakeRtcToNet.handleSignalFromPeer).not.toHaveBeenCalled();
    });

    it('does not send private consent variables to UI', () => {
      var state = alice.currentStateForUi();
      expect(Object.keys(state.consent)).toEqual(
          ['localGrantsAccessToRemote', 'localRequestsAccessFromRemote',
           'remoteGrantsAccessToLocal', 'remoteRequestsAccessFromLocal',
           'ignoringRemoteUserRequest', 'ignoringRemoteUserOffer']);
    });

    it('does not write private consent variables to storage', (done) => {
      alice['saveToStorage']().then(() => {
        storage.load<Core.RemoteInstanceState>(alice.getStorePath()).then((state) => {
          expect(Object.keys(state.consent)).toEqual(
              ['localGrantsAccessToRemote', 'localRequestsAccessFromRemote',
               'remoteGrantsAccessToLocal', 'remoteRequestsAccessFromLocal',
               'ignoringRemoteUserRequest', 'ignoringRemoteUserOffer']);
          done();
        });
      });
    });
  });
});
