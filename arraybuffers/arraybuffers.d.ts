declare module ArrayBuffers {
  function byteEquality(b1:ArrayBuffer, b2:ArrayBuffer) : boolean;
  function arrayBufferToString(buffer:ArrayBuffer) : string;
  function stringToArrayBuffer(s:string) : ArrayBuffer;
  function arrayBufferToHexString(buffer:ArrayBuffer) : string;
  function hexStringToArrayBuffer(hexString:string) : ArrayBuffer;
  function arrayBufferDecodedAsUtf8String(buffer:ArrayBuffer) : string;
  function stringToUtf8EncodedArrayBuffer(str:string) : ArrayBuffer;
  function concat(buffers:ArrayBuffer[]) : ArrayBuffer;
}
