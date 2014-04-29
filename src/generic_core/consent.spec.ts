/**
 * consent.spec.ts
 *
 * This spec just ensures that the various Enum types are actually defined, and
 * distinct, once in Javascript-land.
 *
 * The majority of the consent-to-consent testing between peers happens at the
 * Instance level. (See remote-instance.spec.ts)
 */
/// <reference path='../interfaces/lib/jasmine/jasmine.d.ts' />
/// <reference path='consent.ts' />

describe('Consent', () => {

  it('all Enums are defined in js', () => {
    expect(Consent.UserAction).toBeDefined();
    expect(Consent.ClientState).toBeDefined();
    expect(Consent.ProxyState).toBeDefined();
  });

  it('all functions are defined', () => {
    expect(Consent.userActionOnProxyState).toBeDefined();
    expect(Consent.userActionOnClientState).toBeDefined();
    expect(Consent.updateProxyStateFromRemoteState).toBeDefined();
    expect(Consent.updateClientStateFromRemoteState).toBeDefined();
  });

});  // consent
