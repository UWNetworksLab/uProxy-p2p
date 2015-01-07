
// Quick port of djb2 for comparison of SDP headers to choose initiator.
export var stringHash = (s:string) : number => {
  var hash = 5381;
  for (var i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash) + s.charCodeAt(i); // hash * 33 + c
  }
  return hash;
}
