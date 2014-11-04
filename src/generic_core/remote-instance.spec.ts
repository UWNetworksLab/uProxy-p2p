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
      'getLocalInstanceId',
      'send',
      'notifyUI',
  ]);
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
    spyOn(console, 'error');
  });

  it('constructs from a received Instance Handshake', () => {
    var handshake :Instance = {
      instanceId: 'fakeinstance',
      keyHash:    'fakehash',
      description: 'totally fake',
    }
    instance = new Core.RemoteInstance(user, 'fakeinstance', handshake);
    expect(instance.instanceId).toEqual('fakeinstance');
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

  });

  it('invalid proxy transitions do not modify consent', () => {
    var emptyConsent = new Consent.State();

    instance.consent = new Consent.State();
    instance.modifyConsent(Consent.UserAction.CANCEL_REQUEST);
    expect(instance.consent).toEqual(emptyConsent);
    instance.modifyConsent(Consent.UserAction.UNIGNORE_OFFER);
    expect(instance.consent).toEqual(emptyConsent);
  });

  it('proxy consent modifications did not touch client consent', () => {
    expect(instance.consent.localRequestsAccessFromRemote).toEqual(false);
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

  });

  it('invalid client transitions do not modify consent', () => {
    var emptyConsent = new Consent.State();

    instance.consent = new Consent.State();
    instance.modifyConsent(Consent.UserAction.CANCEL_OFFER);
    expect(instance.consent).toEqual(emptyConsent);
    instance.modifyConsent(Consent.UserAction.UNIGNORE_REQUEST);
    expect(instance.consent).toEqual(emptyConsent);
  });

  it('client consent modifications did not touch proxy consent', () => {
    expect(instance.consent.localGrantsAccessToRemote).toEqual(false);
  });

  describe('receiving consent bits', () => {

    beforeEach(() => {
      // spyOn(user, 'notifyUI');
    });

    it('remote maintains no consent', () => {
      instance.consent = new Consent.State();
      instance.receiveConsent({
        isRequesting: false,
        isOffering:   false
      });
      expect(instance.consent).toEqual(new Consent.State());
    });

    it('remote cancels their consent', () => {
      instance.consent.remoteRequestsAccessFromLocal = true;
      instance.consent.remoteGrantsAccessToLocal = true;
      instance.receiveConsent({
        isRequesting: false,
        isOffering:   false
      });
      expect(instance.consent.remoteRequestsAccessFromLocal).toEqual(false);
      expect(instance.consent.remoteGrantsAccessToLocal).toEqual(false);
    });

    it('remote gives consent', () => {
      instance.consent.remoteRequestsAccessFromLocal = false;
      instance.consent.remoteGrantsAccessToLocal = false;
      instance.receiveConsent({
        isRequesting: true,
        isOffering:   true
      });
      expect(instance.consent.remoteRequestsAccessFromLocal).toEqual(true);
      expect(instance.consent.remoteGrantsAccessToLocal).toEqual(true);
    });

    it('receiving consent bits sends update to UI', () => {
      instance.consent = new Consent.State();
      spyOn(ui, 'syncInstance');
      instance.receiveConsent({
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

  it('sends and receives consent bits in the same format', () => {
    var consentBits :uProxy.Message;
    spyOn(instance, 'send').and.callFake((payload) => {
      consentBits = payload;
    });
    instance.consent = new Consent.State();
    instance.sendConsent();
    expect(consentBits.type).toEqual(uProxy.MessageType.CONSENT);
    var data :ConsentMessage = <ConsentMessage>consentBits.data;
    // The instanceID sent on the wire should not be of the remote's, but of the
    // local uProxy client's.
    expect(data.instanceId).not.toEqual('fakeInstance');
    expect(data.consent).toEqual({
      isRequesting: false,
      isOffering: false
    });
  });

  it('two remote instances establish mutual consent', () => {
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
    // Fake a working signalling channel, and assume only consent messages pass
    // over it. In reality, the interaction would be between a LocalInstance
    // and a RemoteInstance, and there would be other messages.
    spyOn(alice, 'send').and.callFake((payload) => {
      expect(payload.type).toEqual(uProxy.MessageType.CONSENT);
      bob.receiveConsent(payload.data.consent);
    });
    spyOn(bob, 'send').and.callFake((payload) => {
      expect(payload.type).toEqual(uProxy.MessageType.CONSENT);
      alice.receiveConsent(payload.data.consent);
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
      'onceReady': Promise.resolve(),
      'onceStopped': () => { return new Promise((F,R) => {}); },
      'stop': () => {},
      'signalsForPeer': { 'setSyncHandler': () => {} },
      'bytesReceivedFromPeer' : { 'setSyncHandler': () => {} },
      'bytesSentToPeer' : { 'setSyncHandler': () => {} },
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
      alice.handleSignal(uProxy.MessageType.CONSENT, fakeSignal)
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
