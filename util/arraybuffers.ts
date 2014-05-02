module ArrayBuffers {
  /**
   * Converts an ArrayBuffer to a string.
   *
   * @param {ArrayBuffer} buffer The buffer to convert.
   */
  export function arrayBufferToString(buffer:ArrayBuffer) : string {
    var bytes = new Uint8Array(buffer);
    var a = [];
    for (var i = 0; i < bytes.length; ++i) {
      a.push(String.fromCharCode(bytes[i]));
    }
    return a.join('');
  }

  /**
   * Converts a string to an ArrayBuffer.
   *
   * @param {string} s The string to convert.
   */
  export function stringToArrayBuffer(s:string) : ArrayBuffer {
    var buffer = new ArrayBuffer(s.length);
    var bytes = new Uint8Array(buffer);
    for (var i = 0; i < s.length; ++i) {
      bytes[i] = s.charCodeAt(i);
    }
    return buffer;
  }

  /**
   * Converts an ArrayBuffer to a string of hex codes and interpretations as
   * a char code.
   *
   * @param {ArrayBuffer} buffer The buffer to convert.
   */
  export function arrayBufferToHexString(buffer:ArrayBuffer) : string {
    var bytes = new Uint8Array(buffer);
    var a = [];
    for (var i = 0; i < buffer.byteLength; ++i) {
      a.push(bytes[i].toString(16));
    }
    return a.join('.');
  }

  /**
   * Converts a HexString of the regexp form /(hh\.)*hh/ where `h` is a
   * hex-character to an ArrayBuffer.
   *
   * @param {string} hexString The hexString to convert.
   */
  export function hexStringToArrayBuffer(hexString:string) : ArrayBuffer {
    if(hexString === '') { return new ArrayBuffer(0); }
    var hexChars = hexString.split('.');
    var buffer = new ArrayBuffer(hexChars.length);
    var bytes = new Uint8Array(buffer);
    for (var i = 0; i < hexChars.length; ++i) {
        bytes[i] = parseInt('0x' + hexChars[i]);
    }
    return buffer;
  }
}
