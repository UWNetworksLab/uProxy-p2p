/// <reference path='../../../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../../third_party/typings/freedom/freedom.d.ts' />

import arraybuffers = require('../../../third_party/uproxy-lib/arraybuffers/arraybuffers');
import globals = require('./globals');
import pgp = globals.pgp;

export function signEncrypt(plainText :string, key :string) : Promise<string> {
  var ab = arraybuffers.stringToArrayBuffer(plainText);
  return pgp.signEncrypt(ab, key).then((cipherData :ArrayBuffer) => {
    return pgp.armor(cipherData);
  }).catch((e :Error) => {
    return Promise.reject('Error in signEncrypt ' + e);
  });
}

export function verifyDecrypt(cipherText :string, key :string) : Promise<string> {
  return pgp.dearmor(cipherText).then((cipherData :ArrayBuffer) => {
    return pgp.verifyDecrypt(cipherData, key);
  }).then((result :freedom.PgpProvider.VerifyDecryptResult) => {
    return arraybuffers.arrayBufferToString(result.data);
  }).catch((e :Error) => {
    return Promise.reject('Error in verifyDecrypt ' + e);
  });
}