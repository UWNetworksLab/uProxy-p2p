/// <reference path='../../../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../../third_party/typings/freedom/freedom.d.ts' />

import arraybuffers = require('../../../third_party/uproxy-lib/arraybuffers/arraybuffers');
import globals = require('./globals');
import pgp = globals.pgp;

// Sign with private key and encrypt with encryptKey
export function signEncrypt(plainText :string, encryptKey :string) : Promise<string> {
  var ab = arraybuffers.stringToArrayBuffer(plainText);
  return pgp.signEncrypt(ab, encryptKey).then((cipherData :ArrayBuffer) => {
    return pgp.armor(cipherData);
  }).catch((e :Error) => {
    return Promise.reject('Error in signEncrypt ' + e);
  });
}

// Decrypt with private key and verify with verifyKey
export function verifyDecrypt(cipherText :string, verifyKey :string) : Promise<string> {
  return pgp.dearmor(cipherText).then((cipherData :ArrayBuffer) => {
    return pgp.verifyDecrypt(cipherData, verifyKey);
  }).then((result :freedom.PgpProvider.VerifyDecryptResult) => {
    return arraybuffers.arrayBufferToString(result.data);
  }).catch((e :Error) => {
    return Promise.reject('Error in verifyDecrypt ' + e);
  });
}
