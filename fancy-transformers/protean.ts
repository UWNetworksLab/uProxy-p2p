/// <reference path='../../../third_party/uTransformers/utransformers.d.ts' />
/// <reference path='../../../third_party/aes-js/aes-js.d.ts' />

import arraybuffers = require('../arraybuffers/arraybuffers');
import decompression = require('../fancy-transformers/decompressionShaper');
import encryption = require('../fancy-transformers/encryptionShaper');
import fragmentation = require('../fancy-transformers/fragmentationShaper');
import logging = require('../logging/logging');
import sequence = require('../fancy-transformers/byteSequenceShaper');

const log :logging.Log = new logging.Log('protean');

// Accepted in serialised form by configure().
export interface ProteanConfig {
  decompression :decompression.DecompressionConfig;
  encryption :encryption.EncryptionConfig;
  fragmentation :fragmentation.FragmentationConfig;
  injection :sequence.SequenceConfig
}

// Creates a sample (non-random) config, suitable for testing.
export function sampleConfig() :ProteanConfig => {
  return {
    decompression: decompression.sampleConfig(),
    encryption: encryption.sampleConfig(),
    fragmentation: fragmentation.sampleConfig(),
    injection: sequence.sampleConfig()
  };
}

function flatMap<T,E>(input :Array<T>, mappedFunction :(element :T) => Array<E>) :Array<E> {
  return input.reduce((accumulator :Array<E>, item :T) :Array<E> => {
    return accumulator.concat(mappedFunction(item));
  }, []);
}

// A packet shaper that composes multiple transformers.
// The following transformers are composed:
// - Fragmentation based on MTU and chunk size
// - AES encryption
// - decompression using arithmetic coding
// - byte sequence injection
export class Protean implements Transformer {
  // Fragmentation transformer
  private fragmenter_ :fragmentation.FragmentationShaper;

  // Encryption transformer
  private encrypter_ :encryption.EncryptionShaper;

  // Decompression transformer
  private decompresser_ :decompression.DecompressionShaper;

  // Byte sequence injecter transformer
  private injecter_ :sequence.ByteSequenceShaper;

  public constructor() {
    this.configure(JSON.stringify(sampleConfig()));
  }

  // This method is required to implement the Transformer API.
  // @param {ArrayBuffer} key Key to set, not used by this class.
  public setKey = (key :ArrayBuffer) :void => {
    throw new Error('setKey unimplemented');
  }

  public configure = (json :string) :void => {
    let config = JSON.parse(json);

    // Required parameters:
    // - decompression
    // - encryption
    // - fragmentation
    // - injection
    if ('decompression' in config &&
        'encryption' in config &&
        'fragmentation' in config &&
        'injection' in config) {
      this.decompresser_ = new decompression.DecompressionShaper();
      this.encrypter_ = new encryption.EncryptionShaper();
      this.injecter_ = new sequence.ByteSequenceShaper();
      this.fragmenter_ = new fragmentation.FragmentationShaper();

      let proteanConfig = <ProteanConfig>config;
      this.decompresser_.configure(JSON.stringify(proteanConfig.decompression));
      this.encrypter_.configure(JSON.stringify(proteanConfig.encryption));
      this.injecter_.configure(JSON.stringify(proteanConfig.injection));
      this.fragmenter_.configure(JSON.stringify(proteanConfig.fragmentation));
    } else {
      throw new Error(
        "Protean requires fragmentation, encryption, and injection parameters."
      );
    }
  }

  // Apply the following transformations:
  // - Fragment based on MTU and chunk size
  // - Encrypt using AES
  // - Decompress using arithmetic coding
  // - Inject packets with byte sequences
  public transform = (buffer :ArrayBuffer) :ArrayBuffer[] => {
    let source = [buffer];
    let fragmented = flatMap(source, this.fragmenter_.transform);
    let encrypted = flatMap(fragmented, this.encrypter_.transform);
    let decompressed = flatMap(encrypted, this.decompresser_.transform);
    let injected = flatMap(decompressed, this.injecter_.transform);
    return injected;
  }

  // Apply the following transformations:
  // - Discard injected packets
  // - Decrypt with AES
  // - Compress with arithmetic coding
  // - Attempt defragmentation
  public restore = (buffer :ArrayBuffer) :ArrayBuffer[] => {
    let source = [buffer];
    let extracted = flatMap(source, this.injecter_.restore);
    let decompressed = flatMap(extracted, this.decompresser_.restore);
    let decrypted = flatMap(decompressed, this.encrypter_.restore);
    let defragmented = flatMap(decrypted, this.fragmenter_.restore);
    return defragmented;
  }

  // No-op (we have no state or any resources to dispose).
  public dispose = () :void => {}
}
