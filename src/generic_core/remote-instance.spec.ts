/// <reference path='../interfaces/lib/jasmine/jasmine.d.ts' />
/// <reference path='remote-instance.ts' />

describe('Core.RemoteInstance', () => {

  // Prepare a fake Social.Network object to construct User on top of.
  var network = jasmine.createSpyObj('network', [
      'api',
      'send',
      'sendInstanceHandshake'
  ]);
  var instance :Core.RemoteInstance;
  // For remembering consent values.
  var tmpClientConsent :Consent.ClientState;
  var tmpProxyConsent :Consent.ProxyState;

  it('constructs from a received Instance Handshake', () => {

    var handshake :Instance = {
      instanceId: 'fakeinstance',
      keyHash:    'fakehash',
      description: 'totally fake',
    }
    instance = new Core.RemoteInstance(network, handshake);
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

  describe('local consent towards remote proxy', () => {

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

    it('invalid transitions do not modify consent', () => {
      spyOn(console, 'warn');
      instance.consent.asProxy = Consent.ProxyState.NONE;
      instance.modifyConsent(Consent.UserAction.CANCEL_REQUEST);
      expect(instance.consent.asProxy).toEqual(Consent.ProxyState.NONE);
      instance.modifyConsent(Consent.UserAction.ACCEPT_OFFER);
      expect(instance.consent.asProxy).toEqual(Consent.ProxyState.NONE);
      instance.modifyConsent(Consent.UserAction.IGNORE_OFFER);
      expect(instance.consent.asProxy).toEqual(Consent.ProxyState.NONE);
      expect(console.warn).toHaveBeenCalled();
    });

  });

  it('proxy consent modifications did not touch client consent', () => {
    expect(instance.consent.asClient).toEqual(tmpClientConsent);
    tmpProxyConsent = instance.consent.asProxy;
  });

  describe('local consent towards remote client', () => {

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

    it('invalid transitions do not modify consent', () => {
      spyOn(console, 'warn');
      instance.consent.asClient = Consent.ClientState.NONE;
      instance.modifyConsent(Consent.UserAction.CANCEL_OFFER);
      expect(instance.consent.asClient).toEqual(Consent.ClientState.NONE);
      instance.modifyConsent(Consent.UserAction.ALLOW_REQUEST);
      expect(instance.consent.asClient).toEqual(Consent.ClientState.NONE);
      instance.modifyConsent(Consent.UserAction.IGNORE_REQUEST);
      expect(instance.consent.asClient).toEqual(Consent.ClientState.NONE);
      expect(console.warn).toHaveBeenCalled();
    });

  });

  it('client consent modifications did not touch proxy consent', () => {
    expect(instance.consent.asProxy).toEqual(tmpProxyConsent);
  });

  describe('receiving consent bits', () => {

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
      expect(ui.syncInstance).toHaveBeenCalled();
    });

  });

  it('sends and receives consent bits in the same format', () => {
    var consentBits :uProxy.Message;
    spyOn(instance, 'send').and.callFake((payload) => {
      consentBits = payload;
    });
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
    var alice = new Core.RemoteInstance(network, {
      instanceId: 'instance-alice',
      keyHash:    'fake-hash-alice',
      description: 'alice peer',
    });
    var bob = new Core.RemoteInstance(network, {
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

});
