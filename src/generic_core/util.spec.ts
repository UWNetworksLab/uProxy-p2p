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

  describe('FSM (finite-state-machine)', () => {

    var fsm = new FSM<number, number>();

    it('can set a state transition', () => {
      fsm.set(5, 1, 5);
      fsm.set(5, 2, 7);
      expect(fsm.get(5, 1)).toEqual(5);
      expect(fsm.get(5, 2)).toEqual(7);
    });

    it('can override a state transition', () => {
      fsm.set(5, 1, 10);
      expect(fsm.get(5, 1)).toEqual(10);
    });

    it('getting from invalid states return null', () => {
      expect(fsm.get(100, 1)).toEqual(null);
    });

    it('getting from invalid transitions return null', () => {
      expect(fsm.get(5, 3)).toEqual(null);
    });

  });  // describe FSM

  describe('cloneDeep', () => {

    it('handles all supported primitive types', () => {
      expect(cloneDeep(undefined)).toBeUndefined();

      expect(cloneDeep(null)).toBeNull();

      expect(cloneDeep(123)).toBe(123);
      expect(cloneDeep(-12.34)).toBe(-12.34);
      expect(cloneDeep(Infinity)).toBe(Infinity);
      expect(cloneDeep(-Infinity)).toBe(-Infinity);
      // NaNs require special handling because typeof NaN === 'number' but
      // NaN === NaN evaluates to false.
      // TODO: Replace the typeof and isNaN() checks below with a single
      // Number.isNaN() check once we update to ECMAScript 6.
      // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/isNaN#Description
      var clone = cloneDeep(NaN);
      expect(typeof clone).toBe('number');
      expect(isNaN(clone)).toBe(true);

      expect(cloneDeep(true)).toBe(true);
      expect(cloneDeep(false)).toBe(false);

      expect(cloneDeep("this is a string")).toBe("this is a string");
      expect(cloneDeep("")).toBe("");
    });

    it('handles simple arrays', () => {
      expect(cloneDeep([])).toEqual([]);
      expect(cloneDeep([1, 2, 3])).toEqual([1, 2, 3]);
    });

    it('handles simple objects', () => {
      expect(cloneDeep({})).toEqual({});
      expect(cloneDeep({ a: 1, b: 2, c: 3 })).toEqual({ a: 1, b: 2, c: 3 });
    });

    it('rejects unsupported types', () => {
      var square = (x: number) => { return x*x }
      expect(() => {
        cloneDeep(square)
      }).toThrow();
    });

    it('makes deep copies of arrays', () => {
      var foo = [1, 2, 3];
      var clone = cloneDeep(foo);

      // Mutate the original array. The clone should be unaffected.
      foo[0] = 100;

      expect(clone).toEqual([1, 2, 3]);
    });

    it('makes deep copies of objects', () => {
      var foo = {
        a: 1,
        b: 2,
        c: 3
      };
      var clone = cloneDeep(foo);

      // Mutate the original object. The clone should be unaffected.
      foo.a = 100;

      expect(clone).toEqual({
        a: 1,
        b: 2,
        c: 3
      });
    });

    it('handles nontrivial objects and nesting', () => {
      var foo = {
        a: null,
        b: 123,
        c: "this is a string",
        d: [1, 23.45, "dummy text"],
        e: {
          abc: 123,
          def: 456
        }
      };
      var clone = cloneDeep(foo);

      expect(clone).toEqual(foo);

      // Check that array- and object-valued properties are deep copies.
      foo.d[0] = 100;
      expect(clone.d[0]).toBe(1);
      foo.e.abc = 100;
      expect(clone.e.abc).toBe(123);
    });

  });

});  // util
