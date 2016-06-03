/// <reference path='../../../third_party/aes-js/aes-js.d.ts' />
/// <reference path='../../../third_party/typings/browser.d.ts' />

import aesjs = require('aes-js');
import arraybuffers = require('../arraybuffers/arraybuffers');

describe('aes', function() {
  it('simple encrypt/decrypt', () => {
    // aesjs.util.convertStringToBytes works too
    var key = new Uint8Array(arraybuffers.stringToArrayBuffer('Example128BitKey'));
    var iv = new Uint8Array(arraybuffers.stringToArrayBuffer('IVMustBe16Bytes.'));

    var text = 'TextMustBe16Byte';
    var textBytes = arraybuffers.arrayBufferToBuffer((arraybuffers.stringToArrayBuffer(text)));

    var cbc1 = new aesjs.ModeOfOperation.cbc(key, iv);
    var encryptedBytes = cbc1.encrypt(textBytes);

    var cbc2 = new aesjs.ModeOfOperation.cbc(key, iv);
    var decryptedBytes = arraybuffers.bufferToArrayBuffer(cbc2.decrypt(encryptedBytes));
    var decryptedText = aesjs.util.convertBytesToString(new Uint8Array(decryptedBytes));

    expect(decryptedText).toEqual(text);
  });
});
