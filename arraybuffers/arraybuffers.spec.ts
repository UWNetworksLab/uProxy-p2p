/// <reference path='../../build/third_party/typings/jasmine/jasmine.d.ts' />

import ArrayBuffers = require('./arraybuffers');

var uint8Array1 = new Uint8Array([12,118,101,114,105,115]);
var array1 = uint8Array1.buffer;
var string1 = '\x0C\x76\x65\x72\x69\x73';
var hexString1 = 'c.76.65.72.69.73';

var uint8Array2 = new Uint8Array([0,2,129,128,0,1,0,5,0]);
var array2 = uint8Array2.buffer;
var string2 = '\x00\x02\x81\x80\x00\x01\x00\x05\x00';
var hexString2 = '0.2.81.80.0.1.0.5.0';

var uint8Array3 = new Uint8Array(
    [0xE5, 0xA4, 0xA7, 0xE7, 0xBA, 0xAA, 0xE5, 0x85, 0x83]);
var array3 = uint8Array3.buffer;
var string3 = '大纪元';

var uint8Array12 = new Uint8Array(
    [12,118,101,114,105,115,0,2,129,128,0,1,0,5,0]);
var array12 = uint8Array12.buffer;
var string12 = string1 + string2;

var emptyArray = (new Uint8Array([])).buffer;
var emptyString = '';
var emptyHexString = '';

describe('ArrayBuffers <-> Hex Strings', function() {
  it('byteEquality: emptyArray == emptyArray', function() {
    expect(ArrayBuffers.byteEquality(emptyArray, emptyArray)).toBe(true);
  });
  it('byteEquality: array1 == array1', function() {
    expect(ArrayBuffers.byteEquality(array1, array1)).toBe(true);
  });
  it('byteEquality: array1 != emptyArray', function() {
    expect(ArrayBuffers.byteEquality(array1, emptyArray)).toBe(false);
  });
  it('byteEquality: array1 != array2', function() {
    expect(ArrayBuffers.byteEquality(array1, array2)).toBe(false);
  });

  it('Empty Buffer -> Empty Hex', function() {
    expect(ArrayBuffers.arrayBufferToHexString(emptyArray)).toEqual(emptyHexString);
  });
  it('Empty Hex -> Empty Buffer', function() {
    expect(ArrayBuffers.byteEquality(ArrayBuffers.hexStringToArrayBuffer(emptyHexString),
                                     emptyArray)).toBe(true);
  });

  it('Buffer -> Hex', function() {
    expect(ArrayBuffers.arrayBufferToHexString(emptyArray)).toEqual(emptyString);
    expect(ArrayBuffers.arrayBufferToHexString(array1)).toEqual(hexString1);
    expect(ArrayBuffers.arrayBufferToHexString(array2)).toEqual(hexString2);
  });

  it('Hex -> Buffer -> Hex = identity', function() {
    expect(ArrayBuffers.arrayBufferToHexString(ArrayBuffers.hexStringToArrayBuffer(emptyString)))
        .toEqual(emptyString);
    expect(ArrayBuffers.arrayBufferToHexString(ArrayBuffers.hexStringToArrayBuffer(emptyString)))
        .not.toEqual(hexString1);
    expect(ArrayBuffers.arrayBufferToHexString(ArrayBuffers.hexStringToArrayBuffer(hexString1)))
        .toEqual(hexString1);
    expect(ArrayBuffers.arrayBufferToHexString(ArrayBuffers.hexStringToArrayBuffer(hexString2)))
        .toEqual(hexString2);
    expect(ArrayBuffers.arrayBufferToHexString(ArrayBuffers.hexStringToArrayBuffer(hexString1)))
        .not.toEqual(hexString2);
  });
});

describe('ArrayBuffers concat & chunk', function() {
  it('chunk(array12, 6).length == 3', function() {
    expect(ArrayBuffers.chunk(array12,6).length).toBe(3);
  });
  it('chunk(array12, 1).length == 15', function() {
    expect(ArrayBuffers.chunk(array12,1).length).toBe(15);
  });
  it('concat(array1,array2) == array12', function() {
    expect(ArrayBuffers.byteEquality(
        ArrayBuffers.concat([array1, array2]),
        array12))
      .toBe(true);
  });
  it('concat(chunk(array12, 1)) == array12', function() {
    expect(ArrayBuffers.byteEquality(
        ArrayBuffers.concat(ArrayBuffers.chunk(array12,1)),
        array12))
      .toBe(true);
  });
  it('concat(chunk(array12, 4)) == array12', function() {
    expect(ArrayBuffers.byteEquality(
        ArrayBuffers.concat(ArrayBuffers.chunk(array12,4)),
        array12))
      .toBe(true);
  });
  it('concat(chunk(array12, 5)) == array12', function() {
    expect(ArrayBuffers.byteEquality(
        ArrayBuffers.concat(ArrayBuffers.chunk(array12,5)),
        array12))
      .toBe(true);
  });
  it('concat(chunk(array12, array12.byteLength)) == array12', function() {
    expect(ArrayBuffers.byteEquality(
        ArrayBuffers.concat(ArrayBuffers.chunk(array12,array12.byteLength)),
        array12))
      .toBe(true);
  });
  it('concat(chunk(array12, 20)) == array12', function() {
    expect(ArrayBuffers.byteEquality(
        ArrayBuffers.concat(ArrayBuffers.chunk(array12,20)),
        array12))
      .toBe(true);
  });
});

describe('ArrayBuffers <-> strings', function() {
  it('Empty Buffer -> Empty Hex', function() {
    expect(ArrayBuffers.arrayBufferToHexString(emptyArray)).toEqual(emptyString);
  });
  it('Empty Hex -> Empty Buffer', function() {
    expect(ArrayBuffers.byteEquality(ArrayBuffers.hexStringToArrayBuffer(emptyString),
                                     emptyArray)).toBe(true);
  });

  it('Buffer -> String', function() {
    expect(ArrayBuffers.arrayBufferToHexString(emptyArray)).toEqual(emptyString);
    expect(ArrayBuffers.arrayBufferToHexString(array1)).toEqual(hexString1);
    expect(ArrayBuffers.arrayBufferToHexString(array1)).not.toEqual(hexString2);
    expect(ArrayBuffers.arrayBufferToHexString(array2)).toEqual(hexString2);
  });

  it('String -> Buffer -> String = identity', function() {
    expect(ArrayBuffers.arrayBufferToString(ArrayBuffers.stringToArrayBuffer(emptyString)))
        .toEqual(emptyString);
    expect(ArrayBuffers.arrayBufferToString(ArrayBuffers.stringToArrayBuffer(emptyString)))
        .not.toEqual(hexString1);
    expect(ArrayBuffers.arrayBufferToString(ArrayBuffers.stringToArrayBuffer(string1)))
        .toEqual(string1);
    expect(ArrayBuffers.arrayBufferToString(ArrayBuffers.stringToArrayBuffer(string2)))
        .toEqual(string2);
    expect(ArrayBuffers.arrayBufferToString(ArrayBuffers.stringToArrayBuffer(string1)))
        .not.toEqual(string2);
  });
});

describe("ArrayBuffers(UTF8) <-> strings", function() {
  it("Empty Buffer -> Empty String", function() {
    expect(ArrayBuffers.arrayBufferDecodedAsUtf8String(emptyArray)).toEqual(emptyString);
  });
  it("Empty String -> Empty Buffer", function() {
    expect(ArrayBuffers.stringToUtf8EncodedArrayBuffer(emptyString).byteLength).toEqual(0);
  });

  it("Buffer(UTF8) -> String", function() {
    expect(ArrayBuffers.arrayBufferDecodedAsUtf8String(emptyArray)).toEqual(emptyString);
    expect(ArrayBuffers.arrayBufferDecodedAsUtf8String(array1)).toEqual(string1);
    expect(ArrayBuffers.arrayBufferDecodedAsUtf8String(array3)).toEqual(string3);
  });

  it("String -> Buffer(UTF8)", function() {
    expect(ArrayBuffers.byteEquality(
        ArrayBuffers.stringToUtf8EncodedArrayBuffer(emptyString), emptyArray)).toBe(true);
    expect(ArrayBuffers.byteEquality(
        ArrayBuffers.stringToUtf8EncodedArrayBuffer(string1), array1)).toBe(true);
    expect(ArrayBuffers.byteEquality(
        ArrayBuffers.stringToUtf8EncodedArrayBuffer(string3), array3)).toBe(true);
  });

  it("String -> Buffer(UTF8) -> String = identity", function() {
    expect(ArrayBuffers.arrayBufferDecodedAsUtf8String(
        ArrayBuffers.stringToUtf8EncodedArrayBuffer(emptyString))).toEqual(emptyString);
    expect(ArrayBuffers.arrayBufferDecodedAsUtf8String(
        ArrayBuffers.stringToUtf8EncodedArrayBuffer(string1))).toEqual(string1);
    expect(ArrayBuffers.arrayBufferDecodedAsUtf8String(
        ArrayBuffers.stringToUtf8EncodedArrayBuffer(string3))).toEqual(string3);
  });
});
