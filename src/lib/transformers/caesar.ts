import * as logging from '../logging/logging';
import * as transformer from './transformer';

var log :logging.Log = new logging.Log('caesar');

// Accepted in serialised form by configure().
export interface Config {
  // Value by which to shift each byte (0-255).
  key:number;
}

// Creates a sample config, suitable for testing.
export var sampleConfig = () : Config => {
  return {
    key: 1
  };
}

// Caesar cipher.
export class CaesarCipher implements transformer.Transformer {
  /** Value by which bytes' values are shifted. */
  private shift_ :number;

  public constructor() {
    this.configure(JSON.stringify(sampleConfig()));
  }

  public configure = (json:string) : void => {
    var config = <Config>JSON.parse(json);
    if (config.key === undefined) {
      throw new Error('config must have key field');
    }
    if (config.key < 0 || config.key > 255) {
      throw new Error('key must be 0-255');
    }
    this.shift_ = config.key;
  }

  public transform = (buffer:ArrayBuffer) : ArrayBuffer[] => {
    this.map_(buffer, this.transformByte);
    return [buffer];
  }

  public restore = (buffer:ArrayBuffer) : ArrayBuffer[] => {
    this.map_(buffer, this.restoreByte);
    return [buffer];
  }

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
