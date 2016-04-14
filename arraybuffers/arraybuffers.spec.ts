/// <reference path='../../../third_party/typings/browser.d.ts' />

import arraybuffers = require('./arraybuffers');

var uint8Array1 = new Uint8Array([12,118,101,114,105,115]);
var array1 = uint8Array1.buffer;
var string1 = '\x0C\x76\x65\x72\x69\x73';
var hexString1 = 'c.76.65.72.69.73';

var uint8Array2 = new Uint8Array([0,2,129,128,0,1,0,5,0]);
var array2 = uint8Array2.buffer;
var string2 = '\x00\x02\x81\x80\x00\x01\x00\x05\x00';
var hexString2 = '0.2.81.80.0.1.0.5.0';

var uint8Array12 = new Uint8Array(
    [12,118,101,114,105,115,0,2,129,128,0,1,0,5,0]);
var array12 = uint8Array12.buffer;
var string12 = string1 + string2;

var emptyArray = (new Uint8Array([])).buffer;
var emptyString = '';
var emptyHexString = '';

describe('ArrayBuffers <-> Hex Strings', function() {
  it('byteEquality: emptyArray == emptyArray', function() {
    expect(arraybuffers.byteEquality(emptyArray, emptyArray)).toBe(true);
  });
  it('byteEquality: array1 == array1', function() {
    expect(arraybuffers.byteEquality(array1, array1)).toBe(true);
  });
  it('byteEquality: array1 != emptyArray', function() {
    expect(arraybuffers.byteEquality(array1, emptyArray)).toBe(false);
  });
  it('byteEquality: array1 != array2', function() {
    expect(arraybuffers.byteEquality(array1, array2)).toBe(false);
  });

  it('Empty Buffer -> Empty Hex', function() {
    expect(arraybuffers.arrayBufferToHexString(emptyArray)).toEqual(emptyHexString);
  });
  it('Empty Hex -> Empty Buffer', function() {
    expect(arraybuffers.byteEquality(arraybuffers.hexStringToArrayBuffer(emptyHexString),
                                     emptyArray)).toBe(true);
  });

  it('Buffer -> Hex', function() {
    expect(arraybuffers.arrayBufferToHexString(emptyArray)).toEqual(emptyString);
    expect(arraybuffers.arrayBufferToHexString(array1)).toEqual(hexString1);
    expect(arraybuffers.arrayBufferToHexString(array2)).toEqual(hexString2);
  });

  it('Hex -> Buffer -> Hex = identity', function() {
    expect(arraybuffers.arrayBufferToHexString(arraybuffers.hexStringToArrayBuffer(emptyString)))
        .toEqual(emptyString);
    expect(arraybuffers.arrayBufferToHexString(arraybuffers.hexStringToArrayBuffer(emptyString)))
        .not.toEqual(hexString1);
    expect(arraybuffers.arrayBufferToHexString(arraybuffers.hexStringToArrayBuffer(hexString1)))
        .toEqual(hexString1);
    expect(arraybuffers.arrayBufferToHexString(arraybuffers.hexStringToArrayBuffer(hexString2)))
        .toEqual(hexString2);
    expect(arraybuffers.arrayBufferToHexString(arraybuffers.hexStringToArrayBuffer(hexString1)))
        .not.toEqual(hexString2);
  });
});

describe('ArrayBuffers concat & chunk', function() {
  it('chunk(array12, 6).length == 3', function() {
    expect(arraybuffers.chunk(array12,6).length).toBe(3);
  });
  it('chunk(array12, 1).length == 15', function() {
    expect(arraybuffers.chunk(array12,1).length).toBe(15);
  });
  it('concat(array1,array2) == array12', function() {
    expect(arraybuffers.byteEquality(
        arraybuffers.concat([array1, array2]),
        array12))
      .toBe(true);
  });
  it('concat(chunk(array12, 1)) == array12', function() {
    expect(arraybuffers.byteEquality(
        arraybuffers.concat(arraybuffers.chunk(array12,1)),
        array12))
      .toBe(true);
  });
  it('concat(chunk(array12, 4)) == array12', function() {
    expect(arraybuffers.byteEquality(
        arraybuffers.concat(arraybuffers.chunk(array12,4)),
        array12))
      .toBe(true);
  });
  it('concat(chunk(array12, 5)) == array12', function() {
    expect(arraybuffers.byteEquality(
        arraybuffers.concat(arraybuffers.chunk(array12,5)),
        array12))
      .toBe(true);
  });
  it('concat(chunk(array12, array12.byteLength)) == array12', function() {
    expect(arraybuffers.byteEquality(
        arraybuffers.concat(arraybuffers.chunk(array12,array12.byteLength)),
        array12))
      .toBe(true);
  });
  it('concat(chunk(array12, 20)) == array12', function() {
    expect(arraybuffers.byteEquality(
        arraybuffers.concat(arraybuffers.chunk(array12,20)),
        array12))
      .toBe(true);
  });
});

describe('ArrayBuffers <-> strings', function() {
  it('Empty Buffer -> Empty Hex', function() {
    expect(arraybuffers.arrayBufferToHexString(emptyArray)).toEqual(emptyString);
  });
  it('Empty Hex -> Empty Buffer', function() {
    expect(arraybuffers.byteEquality(arraybuffers.hexStringToArrayBuffer(emptyString),
                                     emptyArray)).toBe(true);
  });

  it('Buffer -> String', function() {
    expect(arraybuffers.arrayBufferToHexString(emptyArray)).toEqual(emptyString);
    expect(arraybuffers.arrayBufferToHexString(array1)).toEqual(hexString1);
    expect(arraybuffers.arrayBufferToHexString(array1)).not.toEqual(hexString2);
    expect(arraybuffers.arrayBufferToHexString(array2)).toEqual(hexString2);
  });

  it('String -> Buffer -> String = identity', function() {
    expect(arraybuffers.arrayBufferToString(arraybuffers.stringToArrayBuffer(emptyString)))
        .toEqual(emptyString);
    expect(arraybuffers.arrayBufferToString(arraybuffers.stringToArrayBuffer(emptyString)))
        .not.toEqual(hexString1);
    expect(arraybuffers.arrayBufferToString(arraybuffers.stringToArrayBuffer(string1)))
        .toEqual(string1);
    expect(arraybuffers.arrayBufferToString(arraybuffers.stringToArrayBuffer(string2)))
        .toEqual(string2);
    expect(arraybuffers.arrayBufferToString(arraybuffers.stringToArrayBuffer(string1)))
        .not.toEqual(string2);
  });
});
