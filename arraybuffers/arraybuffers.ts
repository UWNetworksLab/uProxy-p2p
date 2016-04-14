/// <reference path='../../../third_party/typings/browser.d.ts' />

// Byte-wise equality check of array buffers by comparison of each byte's
// value.
export function byteEquality(b1 :ArrayBuffer, b2 :ArrayBuffer)
    :boolean {
  var a1 = new Uint8Array(b1);
  var a2 = new Uint8Array(b2);
  if(a1.byteLength !== a2.byteLength) return false;
  for(var i:number = 0; i < a1.byteLength; ++i) {
    if(a1[i] !== a2[i]) return false;
  }
  return true;
}

// Concat |ArrayBuffer|s into a single ArrayBuffer. If size is given, then
// the destination array buffer is of the given size. If size is not given or
// zero, the  size of all buffers is summed to make the new array buffer.
export function concat(buffers:ArrayBuffer[], size?:number)
    :ArrayBuffer {
  if(!size) {
    size = 0;
    buffers.forEach(a => { size += a.byteLength });
  }
  var accumulatorBuffer = new Uint8Array(size);
  var location = 0;
  buffers.forEach(a => {
    accumulatorBuffer.set(new Uint8Array(a), location);
    location += a.byteLength;
  });
  return accumulatorBuffer.buffer;
}

// Break an array buffer into multiple array buffers that are at most |size|
// types long. Returns 'chunked' array buffers. The array buffers are in
// order such that |byteEquality(concat(chunk(a, n)),a)===true|
export function chunk(buffer:ArrayBuffer, size:number) :ArrayBuffer[] {
  var startByte :number = 0;
  var endByte :number;
  var chunks :ArrayBuffer[] = [];
  while(startByte < buffer.byteLength) {
    endByte = Math.min(startByte + size, buffer.byteLength);
    if(startByte === 0 && endByte === buffer.byteLength) {
      chunks.push(buffer);
    } else {
      chunks.push(buffer.slice(startByte, endByte));
    }
    startByte += size;
  }
  return chunks;
}

// Converts an ArrayBuffer to a string.
export function arrayBufferToString(buffer:ArrayBuffer) :string {
  var bytes = new Uint8Array(buffer);
  var a :string[] = [];
  for (var i = 0; i < bytes.length; ++i) {
    a.push(String.fromCharCode(bytes[i]));
  }
  return a.join('');
}

// Converts a string to an ArrayBuffer.
export function stringToArrayBuffer(s:string) :ArrayBuffer {
  var buffer = new ArrayBuffer(s.length);
  var bytes = new Uint8Array(buffer);
  for (var i = 0; i < s.length; ++i) {
    bytes[i] = s.charCodeAt(i);
  }
  return buffer;
}

// Converts an ArrayBuffer to a string of hex codes (of the regexp form
// /(hh\.)*hh/).
export function arrayBufferToHexString(buffer:ArrayBuffer) :string {
  var bytes = new Uint8Array(buffer);
  var a :string[] = [];
  for (var i = 0; i < buffer.byteLength; ++i) {
    a.push(bytes[i].toString(16));
  }
  return a.join('.');
}

// Converts a HexString of the regexp form /(hh\.)*hh/ (where `h` is a
// hex-character) to an ArrayBuffer.
export function hexStringToArrayBuffer(hexString:string) :ArrayBuffer {
  if(hexString === '') { return new ArrayBuffer(0); }
  var hexChars = hexString.split('.');
  var buffer = new ArrayBuffer(hexChars.length);
  var bytes = new Uint8Array(buffer);
  for (var i = 0; i < hexChars.length; ++i) {
      bytes[i] = parseInt('0x' + hexChars[i]);
  }
  return buffer;
}

// Returns an ArrayBuffer backed by the same memory as the supplied
// Node.js Buffer.
export function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer;
}

// Returns a Node.js Buffer backed by the same memory as the supplied
// ArrayBuffer.
export function arrayBufferToBuffer(ab: ArrayBuffer): Buffer {
  return new Buffer(ab);
}

// Splits an ArrayBuffer into two at a given offset
export function split(buffer:ArrayBuffer, firstLen:number) :[ArrayBuffer, ArrayBuffer] {
  var lastLen :number = buffer.byteLength-firstLen;
  var first = buffer.slice(0, firstLen);
  var last = buffer.slice(firstLen);

  return [first, last];
}

// Wrap a byte in an ArrayBuffer
export function encodeByte(num:number) :ArrayBuffer {
  var bytes = new Uint8Array(1);
  bytes[0] = num;
  return bytes.buffer;
}

// Convert an ArrayBuffer with one element to a byte
export function decodeByte(buffer:ArrayBuffer) :number {
  return new Uint8Array(buffer)[0];
}

// Takes a number and returns a two byte (network byte order) representation
// of this number.
export function encodeShort(len:number) :ArrayBuffer {
  var bytes = new Uint8Array(2);
  bytes[0] = Math.floor(len >> 8);
  bytes[1] = Math.floor((len << 8) >> 8);
  return bytes.buffer;
}

 // Takes a two byte (network byte order) representation of a number and returns
 // the number.
 export function decodeShort(buffer:ArrayBuffer) :number {
  var bytes = new Uint8Array(buffer);
  var result = (bytes[0] << 8) | bytes[1];
  return result;
}

// Parse a buffer into parts using an array of lengths for each part.
// Any remaining bytes left over after parsing are appending to the end.
// This function is intended for using in parsing binary protocols with
// fixed length fields.
export function parse(buffer:ArrayBuffer, lengths:number[]) :ArrayBuffer[] {
  var parts :ArrayBuffer[] = [];

  var part :ArrayBuffer = null;
  var remaining :ArrayBuffer = buffer;

  lengths.forEach(length => {
    if (remaining.byteLength >= length) {
      [part, remaining] = split(remaining, length);
      parts.push(part);
    } else {
      throw new Error('Not enough bytes to parse');
    }
  });

  parts.push(remaining);

  return parts;
}

// Finds the index of a character in an ArrayBuffer
export function indexOf(ab :ArrayBuffer, char :number) :number {
    let bytes = new Uint8Array(ab);
    for(let i = 0; i < bytes.length; ++i) {
      if (bytes[i]==char) {
        return i;
      }
    }

    return -1;
}
