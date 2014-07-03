/// <reference path='../interfaces/lib/jasmine/jasmine.d.ts' />
/// <reference path='auth.ts' />

describe('Authentication', () => {

  it('returns a fingerprint', (done) => {
    Auth.getLocalFingerprint().then((fingerprint) => {
      expect(fingerprint).toEqual('foobar');
    }).then(done);
  });

  it('returns the same fingerprint on 2nd call', (done) => {
    Auth.getLocalFingerprint().then((fingerprint) => {
      expect(fingerprint).toEqual('foobar');
    }).then(done);
  });

});  // authentication
