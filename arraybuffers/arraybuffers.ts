module ArrayBuffers {
  // Equality by byte-value comparison.
  export function byteEquality(b1 :ArrayBuffer, b2 :ArrayBuffer)
      : boolean {
    var a1 = new Uint8Array(b1);
    var a2 = new Uint8Array(b2);
    if(a1.byteLength !== a2.byteLength) return false;
    for(var i:number = 0; i < a1.byteLength; ++i) {
      if(a1[i] !== a2[i]) return false;
    }
    return true;
  }

  // Concat `ArrayBuffer`s into a single ArrayBuffer. If size is given, then the
  // destination array buffer is of the given size. If size is not given or
  // zero, the  size of all buffers is summed to make the new array buffer.
  export function concat(buffers:ArrayBuffer[], size?:number)
      : ArrayBuffer {
    if(!size) {
      size = 0;
      buffers.forEach(a => { size += a.byteLength });
    }
    var accumulatorBuffer = new Uint8Array(size);
    var location = 0;
    buffers.forEach(a => {
      accumulatorBuffer.set(new Uint8Array(a), location);
      location += a.byteLength;
    });
    return accumulatorBuffer.buffer;
  }

  /**
   * Converts an ArrayBuffer to a string.
   *
   * @param {ArrayBuffer} buffer The buffer to convert.
   */
  export function arrayBufferToString(buffer:ArrayBuffer) : string {
    var bytes = new Uint8Array(buffer);
    var a :string[] = [];
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

  declare function escape(s:string): string;
  declare function unescape(s:string): string;

  /**
   * Converts an ArrayBuffer to a string of hex codes and interpretations as
   * a char code.
   *
   * @param {ArrayBuffer} buffer The buffer to convert.
   */
  export function arrayBufferToHexString(buffer:ArrayBuffer) : string {
    var bytes = new Uint8Array(buffer);
    var a :string[] = [];
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

  /**
   * Converts arrayBuffer which has a string encoded in UTF8 to a
   * Javascript string.
   *
   * Note: the array buffer should have a valid string with no zero inside.
   *
   * @param {string} array buffer to convert.
   */
  export function arrayBufferDecodedAsUtf8String(buffer:ArrayBuffer) : string {
    var bytes = new Uint8Array(buffer);
    var a :string[] = [];
    for (var i = 0; i < bytes.length; ++i) {
      a.push(String.fromCharCode(bytes[i]));
    }
    return decodeURIComponent(escape(a.join('')));
  }

  /**
   * Converts javascript string to array buffer using UTF8 encoding.
   *
   * @param {string} string to convert.
   */
  export function stringToUtf8EncodedArrayBuffer(str:string) : ArrayBuffer {
    var strUtf8 = unescape(encodeURIComponent(str));
    var ab = new Uint8Array(strUtf8.length);
    for (var i = 0; i < strUtf8.length; i++) {
        ab[i] = strUtf8.charCodeAt(i);
    }
    return ab.buffer;
  }
}
