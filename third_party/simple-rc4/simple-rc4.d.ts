// TypeScript typings for:
//   https://www.npmjs.com/package/simple-rc4

declare module 'simple-rc4' {
  export default class RC4 {
    constructor(key:Buffer);

    // Returns the supplied Buffer, encoded.
    update(msg: Buffer): Buffer;
  }
}
