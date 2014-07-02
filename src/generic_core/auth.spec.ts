/// <reference path='../interfaces/lib/jasmine/jasmine.d.ts' />
/// <reference path='auth.ts' />

/**
 * Create a mock core.peerconnection class, pretending to be the freedom
 * provider.
 */
class MockCorePeerConnection {

  public createOffer = () => {
    var mockDesc = {
      sdp: 'a=fingerprint:sha-256 foobar '
    };
    return Promise.resolve(mockDesc);
  }

}  // class MockPeerConnection


describe('Authentication', () => {

  beforeEach(() => {
    freedom['core.peerconnection'] = () => {
      return new MockCorePeerConnection();
    };
  });

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
