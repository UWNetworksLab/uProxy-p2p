/// <reference path='../../../third_party/typings/index.d.ts' />

import arraybuffers = require('./arraybuffers');

const array1 = new Uint8Array([12, 118, 101, 114, 105, 115]).buffer;
const array2 = new Uint8Array([0, 2, 129, 128, 0, 1, 0, 5, 0]).buffer;
const array12 = new Uint8Array([12, 118, 101, 114, 105, 115, 0, 2, 129, 128, 0, 1, 0, 5, 0]).buffer;
const emptyArray = (new Uint8Array([])).buffer;

describe('arraybuffers', function() {
  it('byteEquality', function() {
    expect(arraybuffers.byteEquality(emptyArray, emptyArray)).toBe(true);
    expect(arraybuffers.byteEquality(array1, array1)).toBe(true);
    expect(arraybuffers.byteEquality(array1, emptyArray)).toBe(false);
    expect(arraybuffers.byteEquality(array1, array2)).toBe(false);
  });

  it('chunk', function() {
    expect(arraybuffers.chunk(array12, 6).length).toBe(3);
    expect(arraybuffers.chunk(array12, 1).length).toBe(15);
  });
});
