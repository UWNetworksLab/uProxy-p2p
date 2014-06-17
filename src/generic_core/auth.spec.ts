/// <reference path='../interfaces/lib/jasmine/jasmine.d.ts' />
/// <reference path='auth.ts' />

/**
 * Create a mock peer connection class, just for these specs.
 */
class MockRTCPC {

  public createOffer = (callback:(desc)=>void) => {
    var mockDesc = {
      sdp: 'a=fingerprint:sha-256 foobar '
    };
    callback(mockDesc);
  }

}
webkitRTCPeerConnection = <any>MockRTCPC;
Auth['RTCPC'] = MockRTCPC;

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
