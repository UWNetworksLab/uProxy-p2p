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
      trust: {
        asClient: 'nope',
        asProxy: 'nope'
      },
      description: 'totally fake',
      notify: false
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

  describe('consent as your proxy', () => {

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

    it('invalid transitions do not modify.', () => {
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

  describe('consent as your client', () => {

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

    it('invalid transitions do not modify.', () => {
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

  it('sends updates with an Instance Handshake', () => {
  });

});
