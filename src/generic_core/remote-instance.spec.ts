/*
 * remote-instance.spec.ts
 *
 * This file ensures that interactions with a remote instance are correct. For
 * instance, sometimes consent between two instances needs to be resolved after
 * they've been disconnected. This must ensure that we resolve the
 * correct consent values between remote instances.
 */
/// <reference path='../third_party/typings/jasmine/jasmine.d.ts' />
/// <reference path='remote-instance.ts' />

describe('Core.RemoteInstance', () => {

  // Prepare a fake Social.Network object to construct User on top of.
  var user = <Core.User><any>jasmine.createSpyObj('user', [
      'send',
      'notifyUI',
      'instanceToClient'
  ]);

  user.network = <Social.Network><any>jasmine.createSpyObj(
      'network', ['sendInstanceHandshake']);

  user['getLocalInstanceId'] = function() {
      return 'localInstanceId';
  }

  user.isInstanceOnline = function() {
    return true;
  };

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
    var loaded;
    var instance0;

   it('fresh instance has no state', (done) => {
      storage.load = function(key) {
        loaded = realStorage.load(key);
        return loaded;
      };
      storage.save = function(key, value) {
        saved = realStorage.save(key, value);
        return saved;
      };
      Core.RemoteInstance.create(user, 'instanceId', null)
          .then((newInstance) => {
            instance0 = newInstance;
            expect(loaded).toBeDefined();
            loaded.catch(() => {
              expect(instance0.description).not.toBeDefined();
              expect(instance0.keyHash).not.toBeDefined();
              expect(instance0.consent).toEqual(new Consent.State);
              done();
            });
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
      instance0.modifyConsent(Consent.UserAction.REQUEST);
      expect(saved).toBeDefined();

      saved.then(() => {
        Core.RemoteInstance.create(user, 'instanceId', null)
            .then((newInstance) => {
                loaded.then(() => {
                  expect(newInstance.currentState())
                      .toEqual(instance0.currentState());
                }).then(done);
            });
      });
    });

    it ('delay loading', (done) => {
      var fulfill;
      var loaded = realStorage.load(instance0.getStorePath());
      storage.load = function(key) {
        var delay = new Promise((F, R) => {
          fulfill = F;
        });
        return delay.then(() => {
          return loaded;
        });
      }

      var handshake :InstanceHandshake = {
        instanceId : 'instanceId',
        keyHash : 'new-keyhash',
        description: 'new description'
      };
      Core.RemoteInstance.create(user, 'instanceId', handshake)
          .then((instance2) => {
            var consent :Consent.WireState = {
              isRequesting: true,
              isOffering: true,
            };
            instance2.updateConsent(consent);
            loaded.then(() => {
              instance2.description = 'new description';
              expect(instance2.consent.remoteRequestsAccessFromLocal).toEqual(true);
              expect(instance2.consent.remoteGrantsAccessToLocal).toEqual(true);
              storage = new Core.Storage;
            }).then(done);
      });
      fulfill();
    })
  });

  it('constructs from a received Instance Handshake', (done) => {
    var handshake :Instance = {
      instanceId: 'fakeinstance',
      keyHash:    'fakehash',
      description: 'totally fake',
    }
    Core.RemoteInstance.create(user, 'fakeinstance', handshake)
        .then((newInstance) => {
          instance = newInstance;
          expect(instance.instanceId).toEqual('fakeinstance');
          done();
        });
  });

  it('begins with lowest consent bits', () => {
    var emptyConsent = new Consent.State();
    expect(instance.consent).toEqual(emptyConsent);
  });

  it('modifying consent locally also sends consent bits to remote', () => {
    spyOn(instance, 'sendConsent');
    instance.modifyConsent(Consent.UserAction.REQUEST);
    expect(instance.sendConsent).toHaveBeenCalled();
  });

  it('warns about invalid UserAction to modify consent', () => {
    spyOn(instance, 'sendConsent');
    instance.modifyConsent(<Consent.UserAction>-1);
    expect(instance.sendConsent).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith('Invalid Consent.UserAction! -1');
  });

  describe('local consent towards remote proxy', () => {

    beforeEach(() => {
      spyOn(instance, 'sendConsent');
    });

    it('can request access, and cancel that request', () => {
      instance.modifyConsent(Consent.UserAction.REQUEST);
      expect(instance.consent.localRequestsAccessFromRemote).toEqual(true);
      instance.modifyConsent(Consent.UserAction.CANCEL_REQUEST);
      expect(instance.consent.localRequestsAccessFromRemote).toEqual(false);
    });

    it('accepts offer from remote', () => {
      instance.consent.remoteGrantsAccessToLocal = true;
      instance.modifyConsent(Consent.UserAction.REQUEST);
      expect(instance.consent.remoteGrantsAccessToLocal).toEqual(true);
      expect(instance.consent.localRequestsAccessFromRemote).toEqual(true);
    });

    it('ignores offer from remote', () => {
      instance.consent.remoteGrantsAccessToLocal = true;
      instance.modifyConsent(Consent.UserAction.IGNORE_OFFER);
      expect(instance.consent.ignoringRemoteUserOffer).toEqual(true);
    });

    it('can re-accept even after ignoring', () => {
      instance.modifyConsent(Consent.UserAction.REQUEST);
      expect(instance.consent.remoteGrantsAccessToLocal).toEqual(true);
      expect(instance.consent.localRequestsAccessFromRemote).toEqual(true);
    });

    it('cancelling after granted still keeps remote offer', () => {
      instance.modifyConsent(Consent.UserAction.CANCEL_REQUEST);
      expect(instance.consent.remoteGrantsAccessToLocal).toEqual(true);
    });

    it('ignore-offers bit reset after requesting', () => {
      instance.consent.localRequestsAccessFromRemote = false;
      instance.modifyConsent(Consent.UserAction.IGNORE_OFFER);
      expect(instance.consent.ignoringRemoteUserOffer).toEqual(true);
      instance.modifyConsent(Consent.UserAction.REQUEST);
      expect(instance.consent.localRequestsAccessFromRemote).toEqual(true);
      expect(instance.consent.ignoringRemoteUserOffer).toEqual(false);
    });

    afterEach(() => {
      expect(instance.sendConsent).toHaveBeenCalled();
    });

    it('invalid proxy transitions do not modify consent', () => {
      var emptyConsent = new Consent.State();

      instance.consent = new Consent.State();
      instance.modifyConsent(Consent.UserAction.CANCEL_REQUEST);
      expect(instance.consent).toEqual(emptyConsent);
      instance.modifyConsent(Consent.UserAction.UNIGNORE_OFFER);
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
      instance.modifyConsent(Consent.UserAction.OFFER);
      expect(instance.consent.localGrantsAccessToRemote).toEqual(true);
      instance.modifyConsent(Consent.UserAction.CANCEL_OFFER);
      expect(instance.consent.localGrantsAccessToRemote).toEqual(false);
    });

    it('allows request from remote', () => {
      instance.consent.localGrantsAccessToRemote = false;
      instance.modifyConsent(Consent.UserAction.OFFER);
      expect(instance.consent.localGrantsAccessToRemote).toEqual(true);
    });

    it('ignores request from remote', () => {
      instance.consent.remoteRequestsAccessFromLocal = true;
      instance.consent.ignoringRemoteUserRequest = false;
      instance.modifyConsent(Consent.UserAction.IGNORE_REQUEST);
      expect(instance.consent.remoteRequestsAccessFromLocal).toEqual(true);
      expect(instance.consent.ignoringRemoteUserRequest).toEqual(true);
    });

    it('can re-accept even after ignoring', () => {
      instance.modifyConsent(Consent.UserAction.OFFER);
      expect(instance.consent.localGrantsAccessToRemote).toEqual(true);
    });

    it('cancelling after granted returns to remote offer', () => {
      instance.modifyConsent(Consent.UserAction.CANCEL_OFFER);
      expect(instance.consent.localGrantsAccessToRemote).toEqual(false);
      expect(instance.consent.remoteRequestsAccessFromLocal).toEqual(true);
    });

    it('ignore-requests bit reset after granting', () => {
      instance.consent.localGrantsAccessToRemote = false;
      instance.modifyConsent(Consent.UserAction.IGNORE_REQUEST);
      expect(instance.consent.ignoringRemoteUserRequest).toEqual(true);
      instance.modifyConsent(Consent.UserAction.OFFER);
      expect(instance.consent.localGrantsAccessToRemote).toEqual(true);
      expect(instance.consent.ignoringRemoteUserRequest).toEqual(false);
    });

    afterEach(() => {
      expect(instance.sendConsent).toHaveBeenCalled();
    });

    it('invalid client transitions do not modify consent', () => {
      var emptyConsent = new Consent.State();

      instance.consent = new Consent.State();
      instance.modifyConsent(Consent.UserAction.CANCEL_OFFER);
      expect(instance.consent).toEqual(emptyConsent);
      instance.modifyConsent(Consent.UserAction.UNIGNORE_REQUEST);
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

    it('remote cancels their consent', () => {
      instance.consent.remoteRequestsAccessFromLocal = true;
      instance.consent.remoteGrantsAccessToLocal = true;
      instance.updateConsent({
        isRequesting: false,
        isOffering:   false
      });
      expect(instance.consent.remoteRequestsAccessFromLocal).toEqual(false);
      expect(instance.consent.remoteGrantsAccessToLocal).toEqual(false);
    });

    it('remote gives consent', () => {
      instance.consent.remoteRequestsAccessFromLocal = false;
      instance.consent.remoteGrantsAccessToLocal = false;
      instance.updateConsent({
        isRequesting: true,
        isOffering:   true
      });
      expect(instance.consent.remoteRequestsAccessFromLocal).toEqual(true);
      expect(instance.consent.remoteGrantsAccessToLocal).toEqual(true);
    });

    it('receiving consent bits sends update to UI', () => {
      instance.consent = new Consent.State();
      instance.updateConsent({
        isRequesting: false,
        isOffering:   false
      });
      expect(user.notifyUI).toHaveBeenCalled();
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

  it('two remote instances establish mutual consent', () => {
    (<any>user.instanceToClient).and.callFake((instanceId) => {
      return instanceId;
    });

    var alice = new Core.RemoteInstance(user, 'instance-alice', {
      instanceId: 'instance-alice',
      keyHash:    'fake-hash-alice',
      description: 'alice peer',
    });
    var bob = new Core.RemoteInstance(user, 'instance-bob', {
      instanceId: 'instance-bob',
      keyHash:    'fake-hash-bob',
      description: 'alice peer',
    });

    (<any>user.network.sendInstanceHandshake).and.callFake((clientId, consent) => {
      if (clientId === 'instance-alice') {
        bob.updateConsent(consent);
      } else if (clientId === 'instance-bob') {
        alice.updateConsent(consent);
      }
    });

    // Alice wants to proxy through Bob.
    alice.modifyConsent(Consent.UserAction.REQUEST);
    expect(alice.consent.localRequestsAccessFromRemote).toEqual(true);
    expect(alice.consent.remoteGrantsAccessToLocal).toEqual(false);
    expect(bob.consent.remoteRequestsAccessFromLocal).toEqual(true);
    expect(bob.consent.localGrantsAccessToRemote).toEqual(false);
    // Bob accepts / offers
    bob.modifyConsent(Consent.UserAction.OFFER);
    expect(alice.consent.remoteGrantsAccessToLocal).toEqual(true);
    expect(bob.consent.localGrantsAccessToRemote).toEqual(true);
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
    var fakeSocksToRtc = {
      'start':
          (endpoint:Net.Endpoint, pcConfig:WebRtc.PeerConnectionConfig) => {
         return Promise.resolve(endpoint);
      },
      'on': (t:string, f:Function) => {},
      'stop': () => { return Promise.resolve(); }
    };

    it('can start proxying', (done) => {
      alice.consent.localRequestsAccessFromRemote = true;
      alice.consent.remoteGrantsAccessToLocal = true;
      // The module & constructor of SocksToRtc may change in the near future.
      spyOn(SocksToRtc, 'SocksToRtc').and.returnValue(fakeSocksToRtc);
      console.log(JSON.stringify(SocksToRtc));
      alice.start().then(() => {
        expect(alice.access.asProxy).toEqual(true);
        done();
      });
      expect(SocksToRtc.SocksToRtc).toHaveBeenCalled();
      expect(alice.access.asProxy).toEqual(false);
    });

    it('can stop proxying', () => {
      alice.stop();
      expect(alice.access.asProxy).toEqual(false);
    });

    it('refuses to start proxy without permission', () => {
      spyOn(SocksToRtc, 'SocksToRtc').and.returnValue(fakeSocksToRtc);
      alice.consent = new Consent.State();
      alice.access.asProxy = false;
      alice.start();
      expect(alice.access.asProxy).toEqual(false);
    });

    it('does not stop proxying when already stopped', () => {
      alice.stop();
      expect(alice.access.asProxy).toEqual(false);
    });

  });  // describe proxying

  describe('signalling', () => {

    // Build a mock Alice with fake signals and networking hooks.
    var alice = new Core.RemoteInstance(user, 'instance-alice', {
      instanceId: 'instance-alice',
      keyHash:    'fake-hash-alice',
      description: 'alice peer',
    });
    var fakeSocksToRtc = { 'handleSignalFromPeer': () => {} };
    var fakeRtcToNet = { 'handleSignalFromPeer': () => {} };
    alice['socksToRtc_'] = <SocksToRtc.SocksToRtc><any>fakeSocksToRtc;
    alice['rtcToNet_'] = <RtcToNet.RtcToNet><any>fakeRtcToNet;
    // TODO: Turn into a WebRtc.SignallingMessage?
    var fakeSignal :Object = {
      data: 'really fake signal'
    };

    beforeEach(() => {
      spyOn(fakeSocksToRtc, 'handleSignalFromPeer');
      spyOn(fakeRtcToNet, 'handleSignalFromPeer');
      alice.consent.localGrantsAccessToRemote = true;
    });

    it('handles signal from client peer as server', () => {
      alice.handleSignal(uProxy.MessageType.SIGNAL_FROM_CLIENT_PEER, fakeSignal)
      expect(fakeSocksToRtc.handleSignalFromPeer).not.toHaveBeenCalled();
      expect(fakeRtcToNet.handleSignalFromPeer).toHaveBeenCalledWith(fakeSignal);
    });

    it('handles signal from server peer as client', () => {
      alice.handleSignal(uProxy.MessageType.SIGNAL_FROM_SERVER_PEER, fakeSignal)
      expect(fakeSocksToRtc.handleSignalFromPeer).toHaveBeenCalledWith(fakeSignal);
      expect(fakeRtcToNet.handleSignalFromPeer).not.toHaveBeenCalled();
    });

    it('rejects invalid signals', () => {
      alice.handleSignal(uProxy.MessageType.INSTANCE, fakeSignal)
      expect(fakeRtcToNet.handleSignalFromPeer).not.toHaveBeenCalled();
      expect(fakeSocksToRtc.handleSignalFromPeer).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalled();
    });

    it('rejects message from client if consent has not been granted', () => {
      alice.consent.localGrantsAccessToRemote = false;
      alice.handleSignal(uProxy.MessageType.SIGNAL_FROM_CLIENT_PEER, fakeSignal)
      expect(fakeSocksToRtc.handleSignalFromPeer).not.toHaveBeenCalled();
      expect(fakeRtcToNet.handleSignalFromPeer).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalled();
    });

  });  // describe signalling

});
