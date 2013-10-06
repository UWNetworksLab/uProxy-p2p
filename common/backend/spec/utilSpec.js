describe("util", function() {
  describe("extractCryptoKey", function() {
    it("should handle complete SDP headers", function() {
      var sdpHeaders = [
          "a=mid:audio",
          "a=crypto:1 AES_CM_128_HMAC_SHA1_80 inline:ABCDEF",
          "a=mid:data",
          "a=crypto:0 whatever",
          "a=crypto:1 AES_CM_128_HMAC_SHA1_80 inline:ABCDEFG"]
        .join("\r\n");

      var extracted = extractCryptoKey(sdpHeaders);
      expect(extracted).toEqual("ABCDEFG");
    });

    it("should handle missing SDP headers", function() {
      var sdpHeaders = "";

      var extracted = extractCryptoKey(sdpHeaders);
      expect(extracted).toEqual(null);
    });
  });
});
