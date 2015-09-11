/// <reference path='../../../third_party/uTransformers/utransformers.d.ts' />
/// <reference path='../../../third_party/aes-js/aes-js.d.ts' />

import arraybuffers = require('../arraybuffers/arraybuffers');
import encryption = require('../fancy-transformers/encryptionShaper');
import logging = require('../logging/logging');
import sequence = require('../fancy-transformers/byteSequenceShaper');

var log :logging.Log = new logging.Log('protean');

export interface ProteanConfig {
  encryption :encryption.EncryptionConfig;

  injection :sequence.SequenceConfig
}

function flatMap<T,E>(input :Array<T>, func :(t :T) => Array<E>) :Array<E> {
  return input.reduce((ys :Array<E>, x :T) :Array<E> => {
    return ys.concat(func(x));
  }, []);
}

// A packet shaper that encrypts the packets with AES CBC.
export class Protean implements Transformer {
  // Encryption transformer
  private encrypter_ :encryption.EncryptionShaper;

  // Byte sequence injecter transformer
  private injecter_ :sequence.ByteSequenceShaper;

  // Constructor function is needed for typechecking in churn-pipe
  public constructor() {}

  // This method is required to implement the Transformer API.
  // @param {ArrayBuffer} key Key to set, not used by this class.
  public setKey = (key :ArrayBuffer) :void => {}

  public configure = (json :string) :void => {
    var config = JSON.parse(json);

    // Required parameters 'encryption' and 'injection'
    if ('encryption' in config && 'injection' in config) {
      this.encrypter_ = new encryption.EncryptionShaper();
      this.injecter_ = new sequence.ByteSequenceShaper();

      var proteanConfig = <ProteanConfig>config;
      this.encrypter_.configure(JSON.stringify(proteanConfig.encryption));
      this.injecter_.configure(JSON.stringify(proteanConfig.injection));
    } else {
      throw new Error("Protean requires encryption and injection parameters.");
    }
  }

  // Apply the following transformations:
  // - Encrypt using AES
  // - Inject packets with byte sequences
  public transform = (buffer :ArrayBuffer) :ArrayBuffer[] => {
    var source = [buffer];
    var encrypted = flatMap(source, this.encrypter_.transform);
    var injected = flatMap(encrypted, this.injecter_.transform);
    return injected;
  }

  // Apply the following transformations:
  // - Discard injected packets
  // - Decrypt with AES
  public restore = (buffer :ArrayBuffer) :ArrayBuffer[] => {
    var source = [buffer];
    var extracted = flatMap(source, this.injecter_.restore);
    var decrypted = flatMap(extracted, this.encrypter_.restore);
    return decrypted;
  }

  // No-op (we have no state or any resources to dispose).
  public dispose = () :void => {}
}
