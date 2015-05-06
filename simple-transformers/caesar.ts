
// TODO(ldixon): update to a require-style inclusion.
// e.g.
//  import Transformer = require('uproxy-obfuscators/transformer');
/// <reference path='../../../third_party/uTransformers/utransformers.d.ts' />

/**
 * An obfuscator which employs the Caesar cipher. *This does not provide any
 * real security!* It's intended to help prototype the interface between
 * transport and obfuscation and was chosen because even though it's trivial to
 * implement it still requires some configuration.
 */
class CaesarCipher implements Transformer {

  /** Value by which bytes' values are shifted. */
  private shift_ :number;

  public constructor() {}

  /**
   * Caesar cipher requires just one parameter: the value by which to shift
   * each byte. key should be an ArrayBuffer of just one byte, the value of
   * which will be used for the shift amount (the byte is interpreted as
   * an unsigned integer, so negative shift is not possible).
   */
  public setKey = (key:ArrayBuffer) => {
    if (key.byteLength != 1) {
      throw new Error('key must be one byte in length');
    }
    var bytes = new Uint8Array(key);
    this.shift_ = bytes[0];
  }

  /** Nothing to configure -- all this transformer needs is a key. */
  public configure = (json:string) : void => {}

  public transform = (buffer:ArrayBuffer) : ArrayBuffer => {
    this.map_(buffer, this.transformByte);
    return buffer;
  }

  public restore = (buffer:ArrayBuffer) : ArrayBuffer => {
    this.map_(buffer, this.restoreByte);
    return buffer;
  }

  // No-op (we have no state or any resources to dispose).
  public dispose = () : void => {}

  /** Applies mapper to each byte of buffer. */
  private map_ = (
      buffer:ArrayBuffer,
      mapper:(i:number) => number) : void => {
    var bytes = new Uint8Array(buffer);
    for (var i = 0; i < bytes.length; i++) {
      bytes[i] = mapper(bytes[i]);
    }
  }

  // Public for testing.
  public transformByte = (i:number) : number => {
    return (i + this.shift_) % 256;
  }

  // Public for testing.
  public restoreByte = (i:number) : number => {
    i -= this.shift_;
    if (i < 0) {
      i += 256;
    }
    return i % 256;
  }
}

export = CaesarCipher;
