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

  describe("FinalCallback", function() {
    it("Should handle multiple callbacks", function() {
      var x = 0;
      function upX () { x++; }
      var finalCallbacker = new FinalCallback(upX);
      var cb1 = finalCallbacker.makeCountedCallback();
      var cb2 = finalCallbacker.makeCountedCallback();
      var cb3 = finalCallbacker.makeCountedCallback();

      expect(x).toEqual(0);
      cb1();
      expect(x).toEqual(0);
      cb3();
      expect(x).toEqual(0);
      cb2();
      expect(x).toEqual(1);
    });

    it("Can be nested", function() {
      var x = 0;
      function upX () { x++; }
      var finalCallbacker = new FinalCallback(upX);
      var cb1 = finalCallbacker.makeCountedCallback();
      var cb2 = finalCallbacker.makeCountedCallback();
      var cb3 = finalCallbacker.makeCountedCallback();

      var finalCallbacker2 = new FinalCallback(cb2);
      var cb4 = finalCallbacker2.makeCountedCallback();
      var cb5 = finalCallbacker2.makeCountedCallback();

      expect(x).toEqual(0);
      cb1();
      expect(x).toEqual(0);
      cb5();
      expect(x).toEqual(0);
      cb3();
      expect(x).toEqual(0);
      cb4();
      expect(x).toEqual(1);
    });
  });

  describe("restrictToObject", function() {
    it("Simple test", function() {
      var x = { a: 1, b: 2, c: {e: 3, f: 4} };
      var y = { b: { s: "a" }, c: {e: 3, f: 50}, d: 9 };
      var yRestricted = restrictToObject(x,y);
      expect(yRestricted).toEqual({ a: 1, b: { s: "a" }, c: {e: 3, f: 50} });
    });
  });
});  // util
