/// <reference path='../../../third_party/aes-js/aes-js.d.ts' />

import aes = require('aes-js');
import arraybuffers = require('../arraybuffers/arraybuffers');
import logging = require('../logging/logging');
import transformer = require('./transformer');

var log :logging.Log = new logging.Log('encryption shaper');

export const CHUNK_SIZE :number = 16;
export const IV_SIZE :number = 16;

// Accepted in serialised form by configure().
export interface EncryptionConfig {
  key:string
}

// Creates a sample (non-random) config, suitable for testing.
export var sampleConfig = () : EncryptionConfig => {
  return {
    key: new Buffer(16).fill(0).toString('hex')
  };
}

// A packet shaper that encrypts the packets with AES CBC.
export class EncryptionShaper implements transformer.Transformer {
  private key_ :ArrayBuffer;

  public constructor() {
    this.configure(JSON.stringify(sampleConfig()));
  }

  public configure = (json:string) :void => {
    var config = JSON.parse(json);

    // Required parameter
    if ('key' in config) {
      var encryptionConfig = <EncryptionConfig>config;
      this.key_ = new Buffer(encryptionConfig.key, 'hex');
    } else {
      throw new Error('Encryption shaper requires key parameter');
    }
  }

  public transform = (buffer:ArrayBuffer) :ArrayBuffer[] => {
    // This transform performs the following steps:
    // - Generate a new random CHUNK_SIZE-byte IV for every packet
    // - Encrypt the packet contents with the random IV and symmetric key
    // - Concatenate the IV and encrypted packet contents
    var iv :ArrayBuffer = EncryptionShaper.makeIV();
    var encrypted :ArrayBuffer = this.encrypt_(iv, buffer);
    var parts = [iv, encrypted]
    return [arraybuffers.concat(parts)];
  }

  public restore = (buffer:ArrayBuffer) :ArrayBuffer[] => {
    // This restore performs the following steps:
    // - Split the first CHUNK_SIZE bytes from the rest of the packet
    //     The two parts are the IV and the encrypted packet contents
    // - Decrypt the encrypted packet contents with the IV and symmetric key
    // - Return the decrypted packet contents
    var parts = arraybuffers.split(buffer, IV_SIZE);
    var iv = parts[0];
    var ciphertext = parts[1];
    return [this.decrypt_(iv, ciphertext)];
  }

  static makeIV = () :ArrayBuffer => {
    var randomBytes = new Uint8Array(IV_SIZE);
    crypto.getRandomValues(randomBytes);
    return randomBytes.buffer;
  }

  private encrypt_ = (iv:ArrayBuffer, buffer:ArrayBuffer) :ArrayBuffer => {
    var len :ArrayBuffer = arraybuffers.encodeShort(buffer.byteLength);
    var remainder = (len.byteLength + buffer.byteLength) % CHUNK_SIZE;
    var plaintext:ArrayBuffer;
    if (remainder === 0) {
      plaintext = arraybuffers.concat([len, buffer]);
    } else {
      var padding = new Uint8Array(CHUNK_SIZE-remainder);
      crypto.getRandomValues(padding);
      plaintext = arraybuffers.concat([len, buffer, padding.buffer]);
    }

    var cbc = new aes.ModeOfOperation.cbc(new Uint8Array(this.key_), new Uint8Array(iv));
    var chunks = arraybuffers.chunk(plaintext, CHUNK_SIZE);
    for(var x = 0; x < chunks.length; x++) {
      var plainChunk = arraybuffers.arrayBufferToBuffer(chunks[x]);
      var cipherChunk = cbc.encrypt(plainChunk);
      chunks[x] = arraybuffers.bufferToArrayBuffer(cipherChunk);
    }

    return arraybuffers.concat(chunks);
  }

  private decrypt_ = (iv:ArrayBuffer, ciphertext:ArrayBuffer) :ArrayBuffer => {
    var cbc = new aes.ModeOfOperation.cbc(new Uint8Array(this.key_), new Uint8Array(iv));
    var chunks = arraybuffers.chunk(ciphertext, CHUNK_SIZE);
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
