// Small convenience wrapper for WebCrypto random Uint32.
export function randomUint32() : number {
  var randomArray = new Uint32Array(1);
  crypto.getRandomValues(randomArray);
  return randomArray[0];
}
