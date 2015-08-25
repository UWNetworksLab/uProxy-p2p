
// TODO(bwiley): update uTransformers to be compatible with require
// TODO(ldixon): update to a require-style inclusion.
// e.g.
//  import Transformer = require('uproxy-obfuscators/transformer');
/// <reference path='../../../third_party/uTransformers/utransformers.d.ts' />
/// <reference path='../../../third_party/typings/webcrypto/WebCrypto.d.ts' />
/// <reference path='../../../third_party/aes-js/aes-js.d.ts' />

import aes = require('aes-js');
import arraybuffers = require('../arraybuffers/arraybuffers');
import logging = require('../logging/logging');

var log :logging.Log = new logging.Log('encryption-shaper');

export interface EncryptionConfig {key:ArrayBuffer}
export interface SerializedEncryptionConfig {key:string}

// A packet shaper that encrypts the packets with AES CBC.
export class EncryptionShaper implements Transformer {
  private key_ :ArrayBuffer;

  public constructor() {
    log.info('Constructed encryption shaper');
  }

  // This method is required to implement the Transformer API.
  // @param {ArrayBuffer} key Key to set, not used by this class.
  public setKey = (key:ArrayBuffer) :void => {
    // Do nothing.
  }

  public configure = (json:string) :void => {
    log.debug("Configuring encryption shaper");

    try {
      var config=JSON.parse(json);

      // Required parameter
      if('key' in config) {
        var encryptionConfig=this.deserializeConfig_(<SerializedEncryptionConfig>config);
        this.key_=encryptionConfig.key;
      } else {
        log.error('Bad JSON config file');
        log.error(json);
        throw new Error("Encryption shaper requires key parameter");
      }
    } catch(err) {
      // This is a common failure mode for transformers as any problem with the
      // configuration usually results in an exception.
      log.error("Transformer configure crashed");
    }

    log.debug("Configured encryption shaper");
  }

  public transform = (buffer:ArrayBuffer) :ArrayBuffer[] => {
    var iv :ArrayBuffer=this.makeIV_();
    var encrypted :ArrayBuffer=this.encrypt_(iv, buffer);
    var parts=[iv, encrypted]
    return [arraybuffers.concat(parts)];
  }

  public restore = (buffer:ArrayBuffer) :ArrayBuffer[] => {
    var parts = arraybuffers.split(buffer, 16);
    var iv=parts[0];
    var ciphertext=parts[1];
    return [this.decrypt_(iv, ciphertext)];
  }

  // No-op (we have no state or any resources to dispose).
  public dispose = () :void => {}

  private deserializeConfig_ = (config:SerializedEncryptionConfig) :EncryptionConfig => {
    return {key:arraybuffers.hexStringToArrayBuffer(config.key)};
  }

  private makeIV_ = () :ArrayBuffer => {
    var randomBytes=new Uint8Array(16);
    crypto.getRandomValues(randomBytes);
    return randomBytes.buffer;
  }

  private encrypt_ = (iv:ArrayBuffer, buffer:ArrayBuffer) :ArrayBuffer => {
    var len :ArrayBuffer = arraybuffers.encodeShort(buffer.byteLength);
    var remainder = (len.byteLength + buffer.byteLength) % 16;
    var plaintext:ArrayBuffer;
    if (remainder === 0) {
      plaintext=arraybuffers.concat([len, buffer]);
    } else {
      var padding = new Uint8Array(16-remainder);
      crypto.getRandomValues(padding);
      plaintext=arraybuffers.concat([len, buffer, padding.buffer]);
    }

    var cbc = new aes.ModeOfOperation.cbc(new Uint8Array(this.key_), new Uint8Array(iv));
    var chunks = arraybuffers.chunk(plaintext, 16);
    for(var x = 0; x < chunks.length; x++) {
      var plainChunk=arraybuffers.arrayBufferToBuffer(chunks[x]);
      var cipherChunk=cbc.encrypt(plainChunk);
      chunks[x]=arraybuffers.bufferToArrayBuffer(cipherChunk);
    }

    return arraybuffers.concat(chunks);
  }

  private decrypt_ = (iv:ArrayBuffer, ciphertext:ArrayBuffer) :ArrayBuffer => {
    var cbc = new aes.ModeOfOperation.cbc(new Uint8Array(this.key_), new Uint8Array(iv));
    var chunks = arraybuffers.chunk(ciphertext, 16);
    for(var x = 0; x < chunks.length; x++) {
      chunks[x]=arraybuffers.bufferToArrayBuffer(cbc.decrypt(arraybuffers.arrayBufferToBuffer(chunks[x])));
    }

    var plaintext=arraybuffers.concat(chunks);

    var parts = arraybuffers.split(plaintext, 2);
    var lengthBytes = parts[0];
    var length = arraybuffers.decodeShort(lengthBytes);
    var rest = parts[1];
    if(rest.byteLength > length) {
      parts=arraybuffers.split(rest, length);
      return parts[0];
    } else {
      return rest;
    }
  }
}
