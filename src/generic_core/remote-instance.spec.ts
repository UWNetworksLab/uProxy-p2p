/*
 * remote-instance.spec.ts
 *
 * This file ensures that interactions with a remote instance are correct. For
 * instance, sometimes consent between two instances needs to be resolved after
 * they've been disconnected. This must ensure that we resolve the
 * correct consent values between remote instances.
 */
/// <reference path='../interfaces/lib/jasmine/jasmine.d.ts' />
/// <reference path='remote-instance.ts' />

describe('Core.RemoteInstance', () => {

  // Prepare a fake Social.Network object to construct User on top of.
  var user = <Core.User><any>jasmine.createSpyObj('user', [
      'getLocalInstanceId',
      'send',
      'notifyUI',
      'getStorePath'
  ]);
  var instance :Core.RemoteInstance;
  // For remembering consent values.
  var tmpClientConsent :Consent.ClientState;
  var tmpProxyConsent :Consent.ProxyState;
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
    instance = new Core.RemoteInstance(user, handshake);
    expect(instance.instanceId).toEqual('fakeinstance');
  });

  it('begins with lowest consent bits', () => {
    expect(instance.consent.asClient).toEqual(Consent.ClientState.NONE);
    expect(instance.consent.asProxy).toEqual(Consent.ProxyState.NONE);
    tmpClientConsent = instance.consent.asClient;
  });

  it('modifying consent locally also sends consent bits to remote', () => {
    spyOn(instance, 'sendConsent');
    instance.modifyConsent(Consent.UserAction.REQUEST);
    expect(instance.sendConsent).toHaveBeenCalled();
    instance.consent.asProxy = Consent.ProxyState.NONE;
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
      expect(instance.consent.asProxy)
          .toEqual(Consent.ProxyState.USER_REQUESTED);
      instance.modifyConsent(Consent.UserAction.CANCEL_REQUEST);
      expect(instance.consent.asProxy).toEqual(Consent.ProxyState.NONE);
    });

    it('accepts offer from remote', () => {
      instance.consent.asProxy = Consent.ProxyState.REMOTE_OFFERED;
      instance.modifyConsent(Consent.UserAction.ACCEPT_OFFER);
      expect(instance.consent.asProxy).toEqual(Consent.ProxyState.GRANTED);
    });

    it('ignores offer from remote', () => {
      instance.consent.asProxy = Consent.ProxyState.REMOTE_OFFERED;
      instance.modifyConsent(Consent.UserAction.IGNORE_OFFER);
      expect(instance.consent.asProxy).toEqual(
          Consent.ProxyState.USER_IGNORED_OFFER);
    });

    it('can re-accept even after ignoring', () => {
      instance.modifyConsent(Consent.UserAction.ACCEPT_OFFER);
      expect(instance.consent.asProxy).toEqual(Consent.ProxyState.GRANTED);
    });

    it('cancelling after granted returns to remote offer', () => {
      instance.modifyConsent(Consent.UserAction.CANCEL_REQUEST);
      expect(instance.consent.asProxy)
          .toEqual(Consent.ProxyState.REMOTE_OFFERED);
    });

    afterEach(() => {
      expect(instance.sendConsent).toHaveBeenCalled();
    });

  });

  it('invalid proxy transitions do not modify consent', () => {
    instance.consent.asProxy = Consent.ProxyState.NONE;
    instance.modifyConsent(Consent.UserAction.CANCEL_REQUEST);
    expect(instance.consent.asProxy).toEqual(Consent.ProxyState.NONE);
    instance.modifyConsent(Consent.UserAction.ACCEPT_OFFER);
    expect(instance.consent.asProxy).toEqual(Consent.ProxyState.NONE);
    instance.modifyConsent(Consent.UserAction.IGNORE_OFFER);
    expect(instance.consent.asProxy).toEqual(Consent.ProxyState.NONE);
    expect(console.warn).toHaveBeenCalled();
  });

  it('proxy consent modifications did not touch client consent', () => {
    expect(instance.consent.asClient).toEqual(tmpClientConsent);
    tmpProxyConsent = instance.consent.asProxy;
  });

  describe('local consent towards remote client', () => {

    beforeEach(() => {
      spyOn(instance, 'sendConsent');
    });

    it('can offer access, and cancel that offer', () => {
      instance.modifyConsent(Consent.UserAction.OFFER);
      expect(instance.consent.asClient)
          .toEqual(Consent.ClientState.USER_OFFERED);
      instance.modifyConsent(Consent.UserAction.CANCEL_OFFER);
      expect(instance.consent.asClient).toEqual(Consent.ClientState.NONE);
    });

    it('allows request from remote', () => {
      instance.consent.asClient = Consent.ClientState.REMOTE_REQUESTED;
      instance.modifyConsent(Consent.UserAction.ALLOW_REQUEST);
      expect(instance.consent.asClient).toEqual(Consent.ClientState.GRANTED);
    });

    it('ignores request from remote', () => {
      instance.consent.asClient = Consent.ClientState.REMOTE_REQUESTED;
      instance.modifyConsent(Consent.UserAction.IGNORE_REQUEST);
      expect(instance.consent.asClient).toEqual(
          Consent.ClientState.USER_IGNORED_REQUEST);
    });

    it('can re-accept even after ignoring', () => {
      instance.modifyConsent(Consent.UserAction.ALLOW_REQUEST);
      expect(instance.consent.asClient).toEqual(Consent.ClientState.GRANTED);
    });

    it('cancelling after granted returns to remote offer', () => {
      instance.modifyConsent(Consent.UserAction.CANCEL_OFFER);
      expect(instance.consent.asClient)
          .toEqual(Consent.ClientState.REMOTE_REQUESTED);
    });

    afterEach(() => {
      expect(instance.sendConsent).toHaveBeenCalled();
    });

  });

  it('invalid client transitions do not modify consent', () => {
    instance.consent.asClient = Consent.ClientState.NONE;
    instance.modifyConsent(Consent.UserAction.CANCEL_OFFER);
    expect(instance.consent.asClient).toEqual(Consent.ClientState.NONE);
    instance.modifyConsent(Consent.UserAction.ALLOW_REQUEST);
    expect(instance.consent.asClient).toEqual(Consent.ClientState.NONE);
    instance.modifyConsent(Consent.UserAction.IGNORE_REQUEST);
    expect(instance.consent.asClient).toEqual(Consent.ClientState.NONE);
    expect(console.warn).toHaveBeenCalled();
  });

  it('client consent modifications did not touch proxy consent', () => {
    expect(instance.consent.asProxy).toEqual(tmpProxyConsent);
  });

  describe('receiving consent bits', () => {

    beforeEach(() => {
      // spyOn(user, 'notifyUI');
    });

    it('remote maintains no consent', () => {
      instance.consent.asClient = Consent.ClientState.NONE;
      instance.consent.asProxy = Consent.ProxyState.NONE;
      instance.receiveConsent({
        isRequesting: false,
        isOffering:   false
      });
      expect(instance.consent.asClient).toEqual(Consent.ClientState.NONE);
      expect(instance.consent.asProxy).toEqual(Consent.ProxyState.NONE);
    });

    it('remote cancels their consent', () => {
      instance.consent.asClient = Consent.ClientState.REMOTE_REQUESTED;
      instance.consent.asProxy = Consent.ProxyState.REMOTE_OFFERED;
      instance.receiveConsent({
        isRequesting: false,
        isOffering:   false
      });
      expect(instance.consent.asClient).toEqual(Consent.ClientState.NONE);
      expect(instance.consent.asProxy).toEqual(Consent.ProxyState.NONE);
    });

    it('remote reduces mutual consent', () => {
      instance.consent.asClient = Consent.ClientState.GRANTED;
      instance.consent.asProxy = Consent.ProxyState.GRANTED;
      instance.receiveConsent({
        isRequesting: false,
        isOffering:   false
      });
      expect(instance.consent.asClient).toEqual(
          Consent.ClientState.USER_OFFERED);
      expect(instance.consent.asProxy).toEqual(
          Consent.ProxyState.USER_REQUESTED);
    });

    it('remote gives consent', () => {
      instance.consent.asClient = Consent.ClientState.NONE;
      instance.consent.asProxy = Consent.ProxyState.NONE;
      instance.receiveConsent({
        isRequesting: true,
        isOffering:   true
      });
      expect(instance.consent.asClient).toEqual(
          Consent.ClientState.REMOTE_REQUESTED);
      expect(instance.consent.asProxy).toEqual(
          Consent.ProxyState.REMOTE_OFFERED);
    });

    it('remote establishes mutual consent', () => {
      instance.consent.asClient = Consent.ClientState.USER_OFFERED;
      instance.consent.asProxy = Consent.ProxyState.USER_REQUESTED;
      instance.receiveConsent({
        isRequesting: true,
        isOffering:   true
      });
      expect(instance.consent.asClient).toEqual(Consent.ClientState.GRANTED);
      expect(instance.consent.asProxy).toEqual(Consent.ProxyState.GRANTED);
    });

    it('receiving consent bits sends update to UI', () => {
      instance.consent.asClient = Consent.ClientState.NONE;
      instance.consent.asProxy = Consent.ProxyState.NONE;
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
      instance.consent.asProxy = Consent.ProxyState.NONE;
      expect(instance.getConsentBits().isRequesting).toEqual(false);
      instance.consent.asProxy = Consent.ProxyState.REMOTE_OFFERED;
      expect(instance.getConsentBits().isRequesting).toEqual(false);
      instance.consent.asProxy = Consent.ProxyState.USER_IGNORED_OFFER;
      expect(instance.getConsentBits().isRequesting).toEqual(false);
    });

    it('proxy states whilst user is requesting', () => {
      instance.consent.asProxy = Consent.ProxyState.USER_REQUESTED;
      expect(instance.getConsentBits().isRequesting).toEqual(true);
      instance.consent.asProxy = Consent.ProxyState.GRANTED;
      expect(instance.getConsentBits().isRequesting).toEqual(true);
    });


    it('client states whilst user is not offering', () => {
      instance.consent.asClient = Consent.ClientState.NONE;
      expect(instance.getConsentBits().isOffering).toEqual(false);
      instance.consent.asClient = Consent.ClientState.REMOTE_REQUESTED;
      expect(instance.getConsentBits().isOffering).toEqual(false);
      instance.consent.asClient = Consent.ClientState.USER_IGNORED_REQUEST;
      expect(instance.getConsentBits().isOffering).toEqual(false);
    });

    it('client states whilst user is offering', () => {
      instance.consent.asClient = Consent.ClientState.USER_OFFERED;
      expect(instance.getConsentBits().isOffering).toEqual(true);
      instance.consent.asClient = Consent.ClientState.GRANTED;
      expect(instance.getConsentBits().isOffering).toEqual(true);
    });

  });

  it('sends and receives consent bits in the same format', () => {
    var consentBits :uProxy.Message;
    spyOn(instance, 'send').and.callFake((payload) => {
      consentBits = payload;
    });
    instance.consent.asClient = Consent.ClientState.NONE;
    instance.consent.asProxy = Consent.ProxyState.NONE;
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
    var alice = new Core.RemoteInstance(user, {
      instanceId: 'instance-alice',
      keyHash:    'fake-hash-alice',
      description: 'alice peer',
    });
    var bob = new Core.RemoteInstance(user, {
      instanceId: 'instance-bob',
      keyHash:    'fake-hash-bob',
      description: 'alice peer',
    });
    // Fake a working signaling channel, and assume only consent messages pass
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
    expect(alice.consent.asProxy).toEqual(Consent.ProxyState.USER_REQUESTED);
    expect(bob.consent.asClient).toEqual(Consent.ClientState.REMOTE_REQUESTED);
    // Bob accepts / offers
    bob.modifyConsent(Consent.UserAction.OFFER);
    expect(alice.consent.asProxy).toEqual(Consent.ProxyState.GRANTED);
    expect(bob.consent.asClient).toEqual(Consent.ClientState.GRANTED);
  });

  describe('proxying', () => {

    var alice = new Core.RemoteInstance(user, {
      instanceId: 'instance-alice',
      keyHash:    'fake-hash-alice',
      description: 'alice peer',
    });

    beforeEach(() => {
      spyOn(socksToRtcClient, 'emit');
    });

    it('can start proxying', (done) => {
      alice.consent.asProxy = Consent.ProxyState.GRANTED;
      spyOn(alice, 'getLocalPeerId').and.returnValue(localPeerId);
      alice.start().then(() => {
        expect(alice.access.asProxy).toEqual(true);
        done();
      });
      expect(socksToRtcClient.emit).toHaveBeenCalledWith('start', {
          'host': '127.0.0.1', 'port': 9999,
          'peerId': JSON.stringify(localPeerId)
      });
      expect(alice.access.asProxy).toEqual(false);
      alice.handleStartSuccess();
    });

    it('can stop proxying', () => {
      alice.stop();
      expect(socksToRtcClient.emit).toHaveBeenCalledWith('stop');
      expect(alice.access.asProxy).toEqual(false);
    });

    it('refuses to start proxy without permission', () => {
      alice.consent.asProxy = Consent.ProxyState.NONE;
      alice.access.asProxy = false;
      alice.start();
      expect(socksToRtcClient.emit).not.toHaveBeenCalled();
      expect(alice.access.asProxy).toEqual(false);
    });

    it('does not stop proxying when already stopped', () => {
      alice.stop();
      expect(socksToRtcClient.emit).not.toHaveBeenCalled();
      expect(alice.access.asProxy).toEqual(false);
    });

  });  // describe proxying

  describe('signaling', () => {

    var alice = new Core.RemoteInstance(user, {
      instanceId: 'instance-alice',
      keyHash:    'fake-hash-alice',
      description: 'alice peer',
    });

    var fakeSignal :PeerSignal = {
      peerId: JSON.stringify(localPeerId),
      data: 'really fake signal'
    };

    beforeEach(() => {
      spyOn(alice, 'getLocalPeerId').and.returnValue(localPeerId);
      spyOn(socksToRtcClient, 'emit');
      spyOn(rtcToNetServer, 'emit');
    });

    it('handles signal from client peer as server', () => {
      alice.handleSignal(uProxy.MessageType.SIGNAL_FROM_CLIENT_PEER, fakeSignal)
      expect(socksToRtcClient.emit).not.toHaveBeenCalled();
      expect(rtcToNetServer.emit).toHaveBeenCalledWith(
          'handleSignalFromPeer', fakeSignal);
    });

    it('handles signal from server peer as client', () => {
      alice.handleSignal(uProxy.MessageType.SIGNAL_FROM_SERVER_PEER, fakeSignal)
      expect(socksToRtcClient.emit).toHaveBeenCalledWith(
          'handleSignalFromPeer', fakeSignal);
      expect(rtcToNetServer.emit).not.toHaveBeenCalled();
    });

    it('rejects invalid signals', () => {
      alice.handleSignal(uProxy.MessageType.CONSENT, fakeSignal)
      expect(socksToRtcClient.emit).not.toHaveBeenCalled();
      expect(rtcToNetServer.emit).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalled();
    });

  });  // describe signalling

});
