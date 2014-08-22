declare module ArrayBuffers {
  // Byte-wise comparison.
  function byteEquality(b1:ArrayBuffer, b2:ArrayBuffer) : boolean;

  // String-to-array buffer conversion by character code. Does not behave well
  // with strings with high-valued character codes.
  function arrayBufferToString(buffer:ArrayBuffer) : string;
  function stringToArrayBuffer(s:string) : ArrayBuffer;

  // Converts a HexString of the regexp form /(hh\.)*hh/ (where `h` is a
  // hex-character) to/from an ArrayBuffer.
  function arrayBufferToHexString(buffer:ArrayBuffer) : string;
  function hexStringToArrayBuffer(hexString:string) : ArrayBuffer;

  // Converts arrayBuffer which has a string encoded in UTF8 to/from Javascript
  // strings. Note: the array buffer should be a valid string with no zeros
  // inside.
  function arrayBufferDecodedAsUtf8String(buffer:ArrayBuffer) : string;
  function stringToUtf8EncodedArrayBuffer(str:string) : ArrayBuffer;

  // Concat |ArrayBuffer|s into a single ArrayBuffer. If size is given, then
  // the destination array buffer is of the given size. If size is not given or
  // zero, the  size of all buffers is summed to make the new array buffer.
  function concat(buffers:ArrayBuffer[]) : ArrayBuffer;

  // Break an array buffer into multiple array buffers that are at most |size|
  // types long. Returns 'chunked' array buffers. The array buffers are in
  // order such that |byteEquality(concat(chunk(a, n)),a)===true|
  function chunk(buffer:ArrayBuffer, size:number) : ArrayBuffer[]
}
