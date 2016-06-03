/// <reference path='../../../../third_party/typings/browser.d.ts' />

// Returns true if b1 and b2 have exactly the same bytes.
export function byteEquality(b1: ArrayBuffer, b2: ArrayBuffer): boolean {
  // The Buffer instances share memory with their source ArrayBuffers.
  return new Buffer(b1).equals(new Buffer(b2));
}

// Returns a new ArrayBuffer which is the result of concatenating all the
// supplied ArrayBuffers together. If size is supplied, the resulting
// ArrayBuffer will be of the given size.
export function concat(arrayBuffers: ArrayBuffer[], size?: number): ArrayBuffer {
  // The Buffer instances share memory with their source ArrayBuffers.
  return Buffer.concat(arrayBuffers.map(ab => new Buffer(ab)), size).buffer;
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

// Returns the index of the first appearance of i in ab, or -1 if not found.
export function indexOf(ab: ArrayBuffer, i: number): number {
  // The Buffer instance shares memory with the source ArrayBuffer.
  return new Buffer(ab).indexOf(i);
}
