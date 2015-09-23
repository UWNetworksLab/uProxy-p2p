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

// An obfuscator that uses an arithmetic coder to change the entropy.
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

  public transform = (buffer :ArrayBuffer) :ArrayBuffer[] => {
    let header = arraybuffers.encodeByte(0xCA);
    let footer = new ArrayBuffer(2);
    let length = arraybuffers.encodeShort(buffer.byteLength);
    let encoded = arraybuffers.concat([header, buffer, footer, length]);
    let decoded = this.decoder_.decode(encoded).slice(0, -2);
    return [decoded];
  }

  public restore = (buffer :ArrayBuffer) :ArrayBuffer[] => {
    let encoded = this.encoder_.encode(buffer);
    return [encoded.slice(1, -4)];
  }

  // No-op (we have no state or any resources to dispose).
  public dispose = () :void => {}
}
