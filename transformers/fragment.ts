import arraybuffers = require('../arraybuffers/arraybuffers');
import logging = require('../logging/logging');

var log :logging.Log = new logging.Log('fancy-transformers');

// Header size: length + id + fragment number + total number
export const HEADER_SIZE :number = 2 + 32 + 1 + 1;

// A Fragment represents a piece of a packet when fragmentation has occurred.
export interface Fragment {
  length :number;
  id :ArrayBuffer;
  index :number;
  count :number;
  payload :ArrayBuffer;
  padding :ArrayBuffer;
}

// Make a random 32-byte identifier for the packet fragment.
// This should be unique, or else defragmentation breaks.
// A 32-byte size was chosen as this is a common hash function output size.
// In the future, a hash could perhaps be used instead of a random identifier.
export function makeRandomId() :ArrayBuffer {
  var randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  return randomBytes.buffer;
}

// Deserialize the content of a packet into a Fragment object
// The Fragment format is as follows:
//   - length of the payload, 2 bytes
//   - id, 32 bytes
//   - fragment number, 1 byte
//   - total number of fragments for this id, 1 byte
//   - payload, number of bytes specified by length field
//   - padding, variable number of bytes, whatever is left after the payload
export function decode(buffer:ArrayBuffer) :Fragment {
  var [lengthBytes, fragmentId, fragmentNumber, totalNumber, remaining] =
    arraybuffers.parse(buffer, [2, 32, 1, 1]);
  var length = arraybuffers.decodeShort(lengthBytes);

  var payload :ArrayBuffer = null;
  var padding :ArrayBuffer = null;

  if (remaining.byteLength > length) {
    [payload, padding] = arraybuffers.split(remaining, length);
  } else if (buffer.byteLength === length) {
    payload = remaining;
    padding = new ArrayBuffer(0);
  } else {
    // buffer.byteLength < length
    throw new Error("Fragment could not be decoded, shorter than length");
  }

  return {
    length: length,
    id: fragmentId,
    index: arraybuffers.decodeByte(fragmentNumber),
    count: arraybuffers.decodeByte(totalNumber),
    payload: payload,
    padding: padding
  };
}

// Serialize a Fragment object so that it can be sent as a packet
// The Fragment format is as follows:
//   - length of the payload, 2 bytes
//   - id, 32 bytes
//   - fragment number, 1 byte
//   - total number of fragments for this id, 1 byte
//   - payload, number of bytes specified by length field
//   - padding, variable number of bytes, whatever is left after the payload
export function encode(fragment:Fragment) :ArrayBuffer {
  return arraybuffers.concat([
    arraybuffers.encodeShort(fragment.length),
    fragment.id,
    arraybuffers.encodeByte(fragment.index),
    arraybuffers.encodeByte(fragment.count),
    fragment.payload,
    fragment.padding
  ]);
}

function decodeByte(buffer:ArrayBuffer) :number {
  return new Uint8Array(buffer)[0];
}
