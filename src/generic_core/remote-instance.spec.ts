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
  var tmpProxyConsent :Consent.ClientState;

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

  });

  it('proxy consent modifications did not touch client consent', () => {
    expect(instance.consent.asClient).toEqual(tmpClientConsent);
  });

  it('sends updates with an Instance Handshake', () => {
  });

});

