/// <reference path='../../../third_party/typings/jasmine/jasmine.d.ts' />
/// <reference path='../../../third_party/aes-js/aes-js.d.ts' />

import aesjs = require('aes-js');
import arraybuffers = require('../arraybuffers/arraybuffers');

describe('aes', function() {
  it('simple encrypt/decrypt', () => {
    // aesjs.util.convertStringToBytes works too
    var key = new Uint8Array(arraybuffers.stringToArrayBuffer('Example128BitKey'));
    var iv = new Uint8Array(arraybuffers.stringToArrayBuffer('IVMustBe16Bytes.'));

    var text = 'TextMustBe16Byte';
    var textBytes = new Uint8Array(arraybuffers.stringToArrayBuffer(text));

    var cbc1 = new aesjs.ModeOfOperation.cbc(key, iv);
    var encryptedBytes = cbc1.encrypt(textBytes);

    var cbc2 = new aesjs.ModeOfOperation.cbc(key, iv);
    var decryptedBytes = cbc2.decrypt(encryptedBytes);
    // NOTE: Cannot use arraybuffers.arrayBufferToString due to lack of buffer
    //       field in the returned instance.
    var decryptedText = aesjs.util.convertBytesToString(decryptedBytes);

    expect(decryptedText).toEqual(text);
  });
});
