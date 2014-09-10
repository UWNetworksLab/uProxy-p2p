/// <reference path='../third_party/typings/jasmine/jasmine.d.ts' />
/// <reference path='auth.ts' />

describe('Authentication', () => {
  var mockFingerprint = '00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:' +
      '00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF';
  it('returns a fingerprint', (done) => {
    Auth.getLocalFingerprint().then((fingerprint) => {
      expect(fingerprint).toEqual(mockFingerprint);
    }).then(done);
  });

  it('returns the same fingerprint on 2nd call', (done) => {
    Auth.getLocalFingerprint().then((fingerprint) => {
      expect(fingerprint).toEqual(mockFingerprint);
    }).then(done);
  });

  it('extracts correctly on single-line sdp', (done) => {
    var fakeSessionDescription = {
      sdp: 'a=fingerprint:sha-256 ' + mockFingerprint + '\r\n'
    };
    var fingerprint = Auth.extractFingerprint(fakeSessionDescription);
    expect(fingerprint).toEqual(mockFingerprint);
    done();
  });

  it('returns null on short fingerprint', (done) => {
    var fakeSessionDescription = {
      sdp: 'a=fingerprint:sha-256 ' + mockFingerprint.slice(3) + '\r\n'
    };
    var fingerprint = Auth.extractFingerprint(fakeSessionDescription);
    expect(fingerprint).toEqual(null);
    done();
  });

  it('returns null on sub-line attack', (done) => {
    var fakeSessionDescription = {
      sdp: 'a=extmap:5 a=fingerprint:sha-256 ' + mockFingerprint + '\r\n'
    };
    var fingerprint = Auth.extractFingerprint(fakeSessionDescription);
    expect(fingerprint).toEqual(null);
    done();
  });

});  // authentication
