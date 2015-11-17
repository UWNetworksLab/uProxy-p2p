/// <reference path='../../../third_party/uTransformers/utransformers.d.ts' />

/** An obfuscator which does nothing. */
class PassThrough implements Transformer {

  public constructor() {}

  public setKey = (key:ArrayBuffer) => {}

  public configure = (json:string) : void => {}

  public transform = (buffer:ArrayBuffer) : ArrayBuffer[] => {
    return [buffer];
  }

  public restore = (buffer:ArrayBuffer) : ArrayBuffer[] => {
    return [buffer];
  }

  public dispose = () : void => {}
}

export = PassThrough;
