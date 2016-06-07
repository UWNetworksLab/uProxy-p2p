/// <reference path='../typings/browser.d.ts' />

// TypeScript definitions for aes-js:
//   https://github.com/ricmoo/aes-js

// TODO: the other modes of operation!
// TODO: throughout, Uint8Array is interchangeable with number[]

declare module 'aes-js' {
  module ModeOfOperation {
    class cbc {
      // TODO: should key and iv be Buffer too?
      constructor(key:Uint8Array, iv:Uint8Array);
      encrypt(bytes:Buffer) : Buffer;
      decrypt(bytes:Buffer) : Buffer;
    }
  }

  module util {
    function convertStringToBytes(text:string, encoding?:string) : Uint8Array;
    function convertBytesToString(bytes:Uint8Array, encoding?:string) : string;
  }
}
