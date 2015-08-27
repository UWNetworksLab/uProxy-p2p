/// <reference path='../../../third_party/typings/webcrypto/WebCrypto.d.ts' />

import arraybuffers = require('../arraybuffers/arraybuffers');
import logging = require('../logging/logging');

var log :logging.Log = new logging.Log('fancy-transformers');

// Return the first byte of an ArrayBuffer
var takeByte_ = (buffer:ArrayBuffer) :number => {
  return new Uint8Array(buffer)[0];
}

// Return all but the first byte of an ArrayBuffer
var dropByte_ = (buffer:ArrayBuffer) :ArrayBuffer => {
  return buffer.slice(1);
}

// Wrap a byte in an ArrayBuffer
var encodeByte_ = (num:number) :ArrayBuffer => {
  var bytes = new Uint8Array(1);
  bytes[0] = num;
  return bytes.buffer;
}

// A Fragment represents a piece of a packet when fragmentation has occurred.
class Fragment {
  public length_ :number;
  public id_ :ArrayBuffer;
  public index_ :number;
  public count_ :number;
  public payload_ :ArrayBuffer;
  public padding_ :ArrayBuffer;

  public constructor(
    length:number,
    id:ArrayBuffer,
    index:number,
    count:number,
    payload:ArrayBuffer,
    padding:ArrayBuffer) {
      this.length_ = length;
      this.id_ = id;
      this.index_ = index;
      this.count_ = count;
      this.payload_ = payload;
      this.padding_ = padding;
  }

  // Make a random 32-byte identifier for the packet fragment.
  // This should be unique, or else defragmentation breaks.
  // A 32-byte size was chosen as this is a common hash function output size.
  // In the future, a hash could perhaps be used instead of a random identifier.
  static makeRandomId = () :ArrayBuffer => {
    var randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    return randomBytes.buffer;
  }

  // Deserialize the content of a packet into a Fragment object
  // The Fragment format is as follows:
  //   - length, 2 bytes
  //   - id, 32 bytes
  //   - fragment number, 1 byte
  //   - total number of fragments for this id, 1 byte
  //   - payload, number of bytes specified by length field
  //   - padding, variable number of bytes, whatever is left after the payload
  static decodeFragment = (buffer:ArrayBuffer) :Fragment => {
    var parts = arraybuffers.split(buffer, 2);
    var length = arraybuffers.decodeShort(parts[0]);

    parts = arraybuffers.split(parts[1], 32);
    var fragmentId = parts[0];
    buffer = parts[1];

    var fragmentNumber = takeByte_(buffer);
    buffer = dropByte_(buffer);

    var totalNumber = takeByte_(buffer);
    buffer = dropByte_(buffer);

    var payload :ArrayBuffer = null;
    var padding :ArrayBuffer = null;

    if (buffer.byteLength > length) {
      parts = arraybuffers.split(buffer, length);
      payload = parts[0];
      padding = parts[1];
    } else if (buffer.byteLength === length) {
      payload = buffer;
      padding = new ArrayBuffer(0);
    } else {
      // buffer.byteLength < length
      throw new Error("Fragment could not be decoded, shorter than length");
    }

    var fragment = new Fragment(
      length,
      fragmentId,
      fragmentNumber,
      totalNumber,
      payload,
      padding
    );
    return fragment;
  }

  // Serialize a Fragment object so that it can be sent as a packet
  // The Fragment format is as follows:
  //   - length, 2 bytes
  //   - id, 32 bytes
  //   - fragment number, 1 byte
  //   - total number of fragments for this id, 1 byte
  //   - payload, number of bytes specified by length field
  //   - padding, variable number of bytes, whatever is left after the payload
  public encodeFragment = () :ArrayBuffer => {
    return arraybuffers.concat([
      arraybuffers.encodeShort(this.length_),
      this.id_,
      encodeByte_(this.index_),
      encodeByte_(this.count_),
      this.payload_,
      this.padding_
    ]);
  }
}

export = Fragment;
