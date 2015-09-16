/// <reference path='../../../third_party/uTransformers/utransformers.d.ts' />
/// <reference path='../../../third_party/aes-js/aes-js.d.ts' />

import arraybuffers = require('../arraybuffers/arraybuffers');
import encryption = require('../fancy-transformers/encryptionShaper');
import fragmentation = require('../fancy-transformers/fragmentationShaper');
import logging = require('../logging/logging');
import sequence = require('../fancy-transformers/byteSequenceShaper');

var log :logging.Log = new logging.Log('protean');

export interface ProteanConfig {
  encryption :encryption.EncryptionConfig;

  fragmentation :fragmentation.FragmentationConfig;

  injection :sequence.SequenceConfig
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
// - byte sequence injection
export class Protean implements Transformer {
  // Fragmentation transformer
  private fragmenter_ :fragmentation.FragmentationShaper;

  // Encryption transformer
  private encrypter_ :encryption.EncryptionShaper;

  // Byte sequence injecter transformer
  private injecter_ :sequence.ByteSequenceShaper;

  // Constructor function is needed for typechecking in churn-pipe
  public constructor() {}

  // This method is required to implement the Transformer API.
  // @param {ArrayBuffer} key Key to set, not used by this class.
  public setKey = (key :ArrayBuffer) :void => {
    throw new Error('setKey unimplemented');
  }

  public configure = (json :string) :void => {
    var config = JSON.parse(json);

    // Required parameters 'fragmentation', 'encryption', and 'injection'
    if ('encryption' in config && 'injection' in config) {
      this.encrypter_ = new encryption.EncryptionShaper();
      this.injecter_ = new sequence.ByteSequenceShaper();
      this.fragmenter_ = new fragmentation.FragmentationShaper();

      var proteanConfig = <ProteanConfig>config;
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
  // - Inject packets with byte sequences
  public transform = (buffer :ArrayBuffer) :ArrayBuffer[] => {
    var source = [buffer];
    var fragmented = flatMap(source, this.fragmenter_.transform);
    var encrypted = flatMap(fragmented, this.encrypter_.transform);
    var injected = flatMap(encrypted, this.injecter_.transform);
    return injected;
  }

  // Apply the following transformations:
  // - Discard injected packets
  // - Decrypt with AES
  // - Attempt defragmentation
  public restore = (buffer :ArrayBuffer) :ArrayBuffer[] => {
    var source = [buffer];
    var extracted = flatMap(source, this.injecter_.restore);
    var decrypted = flatMap(extracted, this.encrypter_.restore);
    var defragmented = flatMap(decrypted, this.fragmenter_.restore);
    return defragmented;
  }

  // No-op (we have no state or any resources to dispose).
  public dispose = () :void => {}
}
