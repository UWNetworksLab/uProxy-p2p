/// <reference path='../interfaces/lib/jasmine/jasmine.d.ts' />

describe('util', () => {
  describe('extractCryptoKey', () => {
    it('should handle complete SDP headers', () => {
      var sdpHeaders = [
          'a=mid:audio',
          'a=crypto:1 AES_CM_128_HMAC_SHA1_80 inline:ABCDEF',
          'a=mid:data',
          'a=crypto:0 whatever',
          'a=crypto:1 AES_CM_128_HMAC_SHA1_80 inline:ABCDEFG']
        .join('\r\n');

      var extracted = extractCryptoKey(sdpHeaders);
      expect(extracted).toEqual('ABCDEFG');
    });

    it('should handle missing SDP headers', () => {
      var sdpHeaders = '';

      var extracted = extractCryptoKey(sdpHeaders);
      expect(extracted).toEqual(null);
    });
  });

  describe('restrictKeys', () => {
    it('Simple test', () => {
      var x = { a: 1, b: 2, c: {e: 3, f: 4} };
      var y = { b: { s: 'a' }, c: {e: 3, f: 50}, d: 9 };
      var yRestricted = restrictKeys(x,y);
      expect(yRestricted).toEqual({ a: 1, b: { s: 'a' }, c: {e: 3, f: 50} });
    });
  });
});  // util
