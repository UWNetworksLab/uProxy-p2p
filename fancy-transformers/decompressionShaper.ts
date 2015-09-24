/// <reference path='../../../third_party/uTransformers/utransformers.d.ts' />

import arithmetic = require('./arithmetic');
import arraybuffers = require('../arraybuffers/arraybuffers');
import decompression = require('../fancy-transformers/decompressionShaper');
import logging = require('../logging/logging');

const log :logging.Log = new logging.Log('compressionShaper');

export interface DecompressionConfig {
  frequencies:number[]
}

// Creates a sample (non-random) config, suitable for testing.
export function sampleConfig() :decompression.DecompressionConfig {
  let probs :number[] = [];
  for(let index = 0; index < 256; index++) {
    probs.push(1);
  }

  return {
    frequencies: probs
  };
}

// A transformer that uses an arithmetic coder to change the entropy.
// This transformer uses a somewhat unusual technique of reverse compression.
// The only instance I know of this being done previously is in Dust:
// http://github.com/blanu/Dust
//
// Dust uses the reverse Huffman encoding describe in the book "Disappearing
// Cryptography" by Peter Wayner. Chapter 6.2 (p. 88) describes the technique
// as follows:
// "This chapter is about creating an automatic way of taking small, innocuous
// bits of data and embellishing them with deep, embroidered details until the
// result mimics something completely different. The data is hidden as it
// assumes this costume. The effect is accomplished here by running the Huffman
// compression algorithm described in Chapter 5 in reverse. Ordinarily, the
// Huffman algorithm would aprrxoimate the statistical distribution of the text
// and then convert it into a digital shorthand. Running this in reverse can
// take normal data and form it into elaborate patterns."
//
// Dust uses a Huffman encoder, and statistical tests run on the results have
// shown that Huffman encoding has a limitation when used in this way. The
// probabilities of bytes can only be based on powers of two (1/2, 1/4, etc.).
// This limits its facility at mimicry if the mimicked distribution differs
// greatly from an approximation which is quantized into powers of two.
// Therefore, an arithmetic encoder is used here instead of a Huffman encoder.
// As far as I know, this is the first time this has been done, so the results
// compared to Huffman encoding are unknown.
//
// The important thing to realize is that the compression algorithm is being
// run in reverse, contrary to normal expectations.
export class DecompressionShaper implements Transformer {
  private frequencies_ :number[];

  private encoder_ :arithmetic.Encoder;

  private decoder_ :arithmetic.Decoder;

  // Constructor function is needed for typechecking in churn-pipe
  public constructor() {}

  // This method is required to implement the Transformer API.
  // @param {ArrayBuffer} key Key to set, not used by this class.
  public setKey = (key :ArrayBuffer) :void => {
    throw new Error('setKey unimplemented');
  }

  // Configure using the target byte frequencies.
  public configure = (json :string) :void => {
    let config=JSON.parse(json);

    // Required parameter 'frequencies'
    if ('frequencies' in config) {
      let DecompressionConfig = <DecompressionConfig>config;
      this.frequencies_ = DecompressionConfig.frequencies;
      this.encoder_ = new arithmetic.Encoder(this.frequencies_);
      this.decoder_ = new arithmetic.Decoder(this.frequencies_);
    } else {
      throw new Error("Compression shaper requires frequencies parameter");
    }
  }

  // Decompress the bytestream. The purpose of this transform is to take a high
  // entropy bytestream and produce a lower entropy one.
  public transform = (buffer :ArrayBuffer) :ArrayBuffer[] => {
    let header = arraybuffers.encodeByte(0xCA);
    let footer = new ArrayBuffer(2);
    let length = arraybuffers.encodeShort(buffer.byteLength);
    let encoded = arraybuffers.concat([header, buffer, footer, length]);
    // Use a decoder to decompress.
    // This is backwards from what you'd normally expect.
    let decoded = this.decoder_.decode(encoded).slice(0, -2);
    return [decoded];
  }

  public restore = (buffer :ArrayBuffer) :ArrayBuffer[] => {
    // Use an encoder to compress.
    // This is backwards from what you'd normally expect.
    let encoded = this.encoder_.encode(buffer);
    return [encoded.slice(1, -4)];
  }

  // No-op (we have no state or any resources to dispose).
  public dispose = () :void => {}
}
