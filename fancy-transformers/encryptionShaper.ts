/// <reference path='../../../third_party/uTransformers/utransformers.d.ts' />
/// <reference path='../../../third_party/aes-js/aes-js.d.ts' />

import aes = require('aes-js');
import arraybuffers = require('../arraybuffers/arraybuffers');
import logging = require('../logging/logging');

var log :logging.Log = new logging.Log('encryption-shaper');

// Accepted in serialised form by configure().
export interface EncryptionConfig {
  key:string
}

export var sampleConfig = () : EncryptionConfig => {
  return {
    key: arraybuffers.arrayBufferToHexString(new ArrayBuffer(16))
  };
}

// A packet shaper that encrypts the packets with AES CBC.
export class EncryptionShaper implements Transformer {
  private key_ :ArrayBuffer;

  public constructor() {}

  // This method is required to implement the Transformer API.
  // @param {ArrayBuffer} key Key to set, not used by this class.
  public setKey = (key:ArrayBuffer) :void => {
    throw new Error('setKey unimplemented');
  }

  public configure = (json:string) :void => {
    var config = JSON.parse(json);

    // Required parameter
    if ('key' in config) {
      var encryptionConfig = <EncryptionConfig>config;
      this.key_ = arraybuffers.hexStringToArrayBuffer(encryptionConfig.key);
    } else {
      throw new Error("Encryption shaper requires key parameter");
    }
  }

  public transform = (buffer:ArrayBuffer) :ArrayBuffer[] => {
    // This transform performs the following steps:
    // - Generate a new random 16-byte IV for every packet
    // - Encrypt the packet contents with the random IV and symmetric key
    // - Concatenate the IV and encrypted packet contents
    var iv :ArrayBuffer = EncryptionShaper.makeIV();
    var encrypted :ArrayBuffer = this.encrypt_(iv, buffer);
    var parts = [iv, encrypted]
    return [arraybuffers.concat(parts)];
  }

  public restore = (buffer:ArrayBuffer) :ArrayBuffer[] => {
    // This restore performs the following steps:
    // - Split the first 16 bytes from the rest of the packet
    //     The two parts are the IV and the encrypted packet contents
    // - Decrypt the encrypted packet contents with the IV and symmetric key
    // - Return the decrypted packet contents
    var parts = arraybuffers.split(buffer, 16);
    var iv = parts[0];
    var ciphertext = parts[1];
    return [this.decrypt_(iv, ciphertext)];
  }

  // No-op (we have no state or any resources to dispose).
  public dispose = () :void => {}

  static makeIV = () :ArrayBuffer => {
    var randomBytes = new Uint8Array(16);
    crypto.getRandomValues(randomBytes);
    return randomBytes.buffer;
  }

  private encrypt_ = (iv:ArrayBuffer, buffer:ArrayBuffer) :ArrayBuffer => {
    var len :ArrayBuffer = arraybuffers.encodeShort(buffer.byteLength);
    var remainder = (len.byteLength + buffer.byteLength) % 16;
    var plaintext:ArrayBuffer;
    if (remainder === 0) {
      plaintext = arraybuffers.concat([len, buffer]);
    } else {
      var padding = new Uint8Array(16-remainder);
      crypto.getRandomValues(padding);
      plaintext = arraybuffers.concat([len, buffer, padding.buffer]);
    }

    var cbc = new aes.ModeOfOperation.cbc(new Uint8Array(this.key_), new Uint8Array(iv));
    var chunks = arraybuffers.chunk(plaintext, 16);
    for(var x = 0; x < chunks.length; x++) {
      var plainChunk = arraybuffers.arrayBufferToBuffer(chunks[x]);
      var cipherChunk = cbc.encrypt(plainChunk);
      chunks[x] = arraybuffers.bufferToArrayBuffer(cipherChunk);
    }

    return arraybuffers.concat(chunks);
  }

  private decrypt_ = (iv:ArrayBuffer, ciphertext:ArrayBuffer) :ArrayBuffer => {
    var cbc = new aes.ModeOfOperation.cbc(new Uint8Array(this.key_), new Uint8Array(iv));
    var chunks = arraybuffers.chunk(ciphertext, 16);
    for(var x = 0; x < chunks.length; x++) {
      chunks[x] = arraybuffers.bufferToArrayBuffer(cbc.decrypt(arraybuffers.arrayBufferToBuffer(chunks[x])));
    }

    var plaintext = arraybuffers.concat(chunks);

    var parts = arraybuffers.split(plaintext, 2);
    var lengthBytes = parts[0];
    var length = arraybuffers.decodeShort(lengthBytes);
    var rest = parts[1];
    if (rest.byteLength > length) {
      parts = arraybuffers.split(rest, length);
      return parts[0];
    } else {
      return rest;
    }
  }
}
