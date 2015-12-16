/// <reference path='../../../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../../third_party/typings/freedom/freedom.d.ts' />

import arraybuffers = require('../../../third_party/uproxy-lib/arraybuffers/arraybuffers');
import globals = require('./globals');
import pgp = globals.pgp;

// Sign with private key and encrypt with encryptKey
export function signEncrypt(plainText :string, encryptKey :string) : Promise<string> {
  var ab = arraybuffers.stringToArrayBuffer(plainText);
  var startTime = new Date();
  var id = startTime.getTime();
  console.log(id + " Encryption: starting at " + startTime);
  return pgp.signEncrypt(ab, encryptKey).then((cipherData :ArrayBuffer) => {
    var endTime = new Date();
    console.log(id + " Encryption: completed at " + endTime);
    console.log(id + " Encryption: time elapsed " + - (id - endTime.getTime()));
    return pgp.armor(cipherData);
  }).catch((e :Error) => {
    console.log(id + "Encryption: failed at " + new Date());
    return Promise.reject('Error in signEncrypt ' + e);
  });
}

// Decrypt with private key and verify with verifyKey
export function verifyDecrypt(cipherText :string, verifyKey :string) : Promise<string> {
  var startTime = new Date();
  var id = startTime.getTime();
  console.log(id + " Decryption: starting at " + startTime);
  return pgp.dearmor(cipherText).then((cipherData :ArrayBuffer) => {
    return pgp.verifyDecrypt(cipherData, verifyKey);
  }).then((result :freedom.PgpProvider.VerifyDecryptResult) => {
    var endTime = new Date();
    console.log(id + " Decryption: completed at " + endTime);
    console.log(id + " Decryption: time elapsed " + - (id - endTime.getTime()));
    return arraybuffers.arrayBufferToString(result.data);
  }).catch((e :Error) => {
    console.log("Decryption: failed at " + new Date());
    return Promise.reject('Error in verifyDecrypt ' + e);
  });
}
