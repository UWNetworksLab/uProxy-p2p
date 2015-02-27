/// <reference path='../third_party/typings/jasmine/jasmine.d.ts' />

describe('util', () => {

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

    it('maps identical references to distinct references', () => {
      var a = { x: 1 };
      var foo = { a1: a, a2: a };
      var clone = cloneDeep(foo);

      expect(clone.a1).toEqual(clone.a2);   // equal...
      expect(clone.a1).not.toBe(clone.a2);  // ... but not identical
    });

  });

});  // util
