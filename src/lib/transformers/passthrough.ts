import * as transformer from './transformer';

/** An obfuscator which does nothing. */
export default class PassThrough implements transformer.Transformer {

  public constructor() {}

  public configure = (json:string) : void => {}

  public transform = (buffer:ArrayBuffer) : ArrayBuffer[] => {
    return [buffer];
  }

  public restore = (buffer:ArrayBuffer) : ArrayBuffer[] => {
    return [buffer];
  }
}
