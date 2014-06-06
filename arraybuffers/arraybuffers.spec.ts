/// <reference path='arraybuffers.ts' />
/// <reference path='../../third_party/DefinitelyTyped/jasmine/jasmine.d.ts' />
/// <reference path='arraybuffers.d.ts' />

module ArrayBuffers {

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

  var emptyArray = (new Uint8Array([])).buffer;
  var emptyString = '';
  var emptyHexString = '';

  describe("ArrayBuffers <-> Hex Strings", function() {
    it("arrayBufferEquality: emptyArray == emptyArray", function() {
      expect(ArrayBuffers.byteEquality(emptyArray, emptyArray)).toBe(true);
    });
    it("arrayBufferEquality: array1 == array1", function() {
      expect(ArrayBuffers.byteEquality(array1, array1)).toBe(true);
    });
    it("arrayBufferEquality: array1 != emptyArray", function() {
      expect(ArrayBuffers.byteEquality(array1, emptyArray)).toBe(false);
    });
    it("arrayBufferEquality: array1 != array2", function() {
      expect(ArrayBuffers.byteEquality(array1, array2)).toBe(false);
    });

    it("Empty Buffer -> Empty Hex", function() {
      expect(arrayBufferToHexString(emptyArray)).toEqual(emptyHexString);
    });
    it("Empty Hex -> Empty Buffer", function() {
      expect(ArrayBuffers.byteEquality(hexStringToArrayBuffer(emptyHexString),
                                       emptyArray)).toBe(true);
    });

    it("Buffer -> Hex", function() {
      expect(arrayBufferToHexString(emptyArray)).toEqual(emptyString);
      expect(arrayBufferToHexString(array1)).toEqual(hexString1);
      expect(arrayBufferToHexString(array2)).toEqual(hexString2);
    });

    it("Hex -> Buffer -> Hex = identity", function() {
      expect(arrayBufferToHexString(hexStringToArrayBuffer(emptyString)))
          .toEqual(emptyString);
      expect(arrayBufferToHexString(hexStringToArrayBuffer(emptyString)))
          .not.toEqual(hexString1);
      expect(arrayBufferToHexString(hexStringToArrayBuffer(hexString1)))
          .toEqual(hexString1);
      expect(arrayBufferToHexString(hexStringToArrayBuffer(hexString2)))
          .toEqual(hexString2);
      expect(arrayBufferToHexString(hexStringToArrayBuffer(hexString1)))
          .not.toEqual(hexString2);
    });
  });


  describe("ArrayBuffers <-> strings", function() {
    it("Empty Buffer -> Empty Hex", function() {
      expect(arrayBufferToHexString(emptyArray)).toEqual(emptyString);
    });
    it("Empty Hex -> Empty Buffer", function() {
      expect(ArrayBuffers.byteEquality(hexStringToArrayBuffer(emptyString),
                                       emptyArray)).toBe(true);
    });

    it("Buffer -> String", function() {
      expect(arrayBufferToHexString(emptyArray)).toEqual(emptyString);
      expect(arrayBufferToHexString(array1)).toEqual(hexString1);
      expect(arrayBufferToHexString(array1)).not.toEqual(hexString2);
      expect(arrayBufferToHexString(array2)).toEqual(hexString2);
    });

    it("String -> Buffer -> String = identity", function() {
      expect(arrayBufferToString(stringToArrayBuffer(emptyString)))
          .toEqual(emptyString);
      expect(arrayBufferToString(stringToArrayBuffer(emptyString)))
          .not.toEqual(hexString1);
      expect(arrayBufferToString(stringToArrayBuffer(string1)))
          .toEqual(string1);
      expect(arrayBufferToString(stringToArrayBuffer(string2)))
          .toEqual(string2);
      expect(arrayBufferToString(stringToArrayBuffer(string1)))
          .not.toEqual(string2);
    });
  });

  describe("ArrayBuffers(UTF8) <-> strings", function() {
    it("Empty Buffer -> Empty String", function() {
      expect(arrayBufferDecodedAsUtf8String(emptyArray)).toEqual(emptyString);
    });
    it("Empty String -> Empty Buffer", function() {
      expect(stringToUtf8EncodedArrayBuffer(emptyString).byteLength).toEqual(0);
    });

    it("Buffer(UTF8) -> String", function() {
      expect(arrayBufferDecodedAsUtf8String(emptyArray)).toEqual(emptyString);
      expect(arrayBufferDecodedAsUtf8String(array1)).toEqual(string1);
      expect(arrayBufferDecodedAsUtf8String(array3)).toEqual(string3);
    });

    it("String -> Buffer(UTF8)", function() {
      expect(arrayBufferEquality(
          stringToUtf8EncodedArrayBuffer(emptyString), emptyArray)).toBe(true);
      expect(arrayBufferEquality(
          stringToUtf8EncodedArrayBuffer(string1), array1)).toBe(true);
      expect(arrayBufferEquality(
          stringToUtf8EncodedArrayBuffer(string3), array3)).toBe(true);
    });

    it("String -> Buffer(UTF8) -> String = identity", function() {
      expect(arrayBufferDecodedAsUtf8String(
          stringToUtf8EncodedArrayBuffer(emptyString))).toEqual(emptyString);
      expect(arrayBufferDecodedAsUtf8String(
          stringToUtf8EncodedArrayBuffer(string1))).toEqual(string1);
      expect(arrayBufferDecodedAsUtf8String(
          stringToUtf8EncodedArrayBuffer(string3))).toEqual(string3);
    });
  });

}  // module ArrayBuffers
