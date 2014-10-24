/**
 * consent.spec.ts
 *
 * This spec just ensures that the various Enum types are actually defined, and
 * distinct, once in Javascript-land.
 *
 * The majority of the consent-to-consent testing between peers happens at the
 * Instance level. (See remote-instance.spec.ts)
 */
/// <reference path='../third_party/typings/jasmine/jasmine.d.ts' />
/// <reference path='consent.ts' />

describe('Consent', () => {

  it('all Enums are defined in js', () => {
    expect(Consent.UserAction).toBeDefined();
  });

  it('all functions are defined', () => {
    expect(Consent.handleUserAction).toBeDefined();
    expect(Consent.updateStateFromRemoteState).toBeDefined();
  });

});  // consent
