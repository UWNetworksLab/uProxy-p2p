// TODO(ldixon): update to a require-style inclusion.
// e.g.
//  import Transformer = require('uproxy-obfuscators/transformer');
/// <reference path='../../../third_party/uTransformers/utransformers.d.ts' />

/** An obfuscator which does nothing. */
class PassThrough implements Transformer {

  public setKey = (key:ArrayBuffer) => {}

  public configure = (json:string) : void => {}

  public transform = (buffer:ArrayBuffer) : ArrayBuffer => {
    return buffer;
  }

  public restore = (buffer:ArrayBuffer) : ArrayBuffer => {
    return buffer;
  }

  public dispose = () : void => {}
}

export = PassThrough;
