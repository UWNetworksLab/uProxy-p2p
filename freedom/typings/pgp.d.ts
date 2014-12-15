/// <reference path="../../third_party/typings/es6-promise/es6-promise.d.ts" />

// This is the interface that a module that has logger as a dependency gets to
// use.

interface PgpKey {
  uids :string[];
}

interface VerifyDecryptResult {
  data :ArrayBuffer;
  signedBy :string[];
}

interface PgpProvider {
  // Standard freedom crypto API
  setup(passphrase:string, userid:string) :Promise<void>;
  exportKey() :Promise<string>;
  signEncrypt(data:ArrayBuffer, encryptKey?:string,
              sign?:boolean) :Promise<ArrayBuffer>;
  verifyDecrypt(data:ArrayBuffer,
                verifyKey?:string) :Promise<VerifyDecryptResult>;
  armor(data:ArrayBuffer, type?:string) :Promise<string>;
  dearmor(data:string) :Promise<ArrayBuffer>;
}
