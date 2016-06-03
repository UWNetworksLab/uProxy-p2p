/// <reference path='../../../third_party/simple-rc4/simple-rc4.d.ts' />
/// <reference path='../../../third_party/typings/browser.d.ts' />

import crypto = require('crypto');
import logging = require('../logging/logging');
import rc4 = require('simple-rc4');
import transformer = require('./transformer');

const log = new logging.Log('rc4 transformer');

// Accepted in serialised form by configure().
export interface Config {
  key: string
}

const KEY_LENGTH_BYTES = 16;
const R_LENGTH_BYTES = 8;
const TRUNCATED_IV_LENGTH_BYTES = 8;

// Creates a sample (non-random) config, suitable for testing.
export function sampleConfig(): Config {
  return {
    key: new Buffer(KEY_LENGTH_BYTES).fill(0).toString('hex')
  };
}

// Fast, uniformly random transformer with minimal length expansion, via RC4.
// From a proposal by kpdyer.
//
// Terminology:
//  - K: 128-bit session key, negotiated through the signalling channel
//  - RANDOM(N): a cryptographically secure N-byte string
//  - X[n,...,m]: the (m - n + 1) bytes starting at byte-index n of X
//  - |X|: length, in bytes, of X
//
// Pseudo-code:
//   def Encrypt(K, P):
//     R = RANDOM(8)
//     IV = SHA1(K || R)
//     RET R || RC4(IV[0,...,7], P)
//
//   def Decrypt(K, C):
//     R = C[0,...,7]
//     IV = SHA1(K || R)
//     RET RC4(IV[0,...,7], C[8,...,|C | -1])
export class Rc4Transformer implements transformer.Transformer {
  private key_: Buffer;

  public constructor() {
    this.configure(JSON.stringify(sampleConfig()));
  }

  public configure = (json: string): void => {
    try {
      const config = <Config>JSON.parse(json);
      if (config.key === undefined) {
        throw new Error('must set key parameter');
      }
      const key = new Buffer(config.key, 'hex');
      if (key.byteLength !== KEY_LENGTH_BYTES) {
        throw new Error('keys must be ' + KEY_LENGTH_BYTES + ' bytes in length');
      }
      this.key_ = key;
    } catch (e) {
      throw new Error('could not parse config: ' + e.message);
    }
  }

  // Applies RC4(IV[0,...,7] to bytes, as described in the pseudocode above.
  private update_ = (r: Buffer, bytes:Buffer): void => {
    const hasher = crypto.createHash('sha1');
    const iv = hasher.update(Buffer.concat([this.key_, r]));
    const truncatedIv = iv.digest().slice(0, TRUNCATED_IV_LENGTH_BYTES);
    new rc4(truncatedIv).update(bytes);
  }

  public transform = (ab: ArrayBuffer): ArrayBuffer[] => {
    const p = new Buffer(ab);

    const r = crypto.randomBytes(R_LENGTH_BYTES);
    this.update_(r, p);

    return [Buffer.concat([r, p]).buffer];
  }

  public restore = (ab: ArrayBuffer): ArrayBuffer[] => {
    const c = new Buffer(ab);

    const r = c.slice(0, R_LENGTH_BYTES);
    const tail = c.slice(R_LENGTH_BYTES);
    this.update_(r, tail);

    // Because tail is constructed via Buffer#slice, its buffer field
    // still references ab, which still includes r.
    const slicedResult = tail.buffer.slice(8);
    return [slicedResult];
  }
}
