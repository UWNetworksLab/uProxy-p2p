// Alternative to crypto-browserify's randombytes shim which
// falls back to freedom.js core.crypto when crypto.getRandomValues is
// unavailable, which is currently the case in Firefox web workers.
// TODO: post FF48 (2016-08-02) switch to just native crypto.getRandomValues

var nativeCrypto = typeof crypto !== 'undefined';
var refreshBuffer, bufferRemaining;
if (!nativeCrypto) {
  // Filling with freedom.js core.crypto, which requires a buffer due to async
  var rand = freedom['core.crypto'](),
      buf,
      offset = 0;
  refreshBuffer = function (size) {
    return rand.getRandomBytes(size).then(function (bytes) {
      buf = new Uint8Array(bytes);
      offset = 0;
    }, function (err) {
      console.log(err);
    });
  }.bind(this);
  refreshBuffer(10000);  // initial randomness
  bufferRemaining = 10000;

  crypto = {};
  crypto.getRandomValues = function (buffer) {
    if (buffer.buffer) {
      buffer = buffer.buffer;
    }
    var size = buffer.byteLength,
        view = new Uint8Array(buffer),
        i;
    if (offset + size > buf.length) {
      throw new Error("Insufficient Randomness Allocated.");
    }
    for (i = 0; i < size; i += 1) {
      view[i] = buf[offset + i];
    }
    offset += size;
    bufferRemaining -= size;
  };
}

module.exports = function(size, cb) {
  var buffer = new Buffer(size);
  if (!nativeCrypto && bufferRemaining < size*10) {
    // using freedom.js core.crypto, may need to refresh buffer
    refreshBuffer(size*100);
  }
  crypto.getRandomValues(buffer);
  if (cb) {
    cb(undefined, buffer);
  } else {
    return buffer;
  }
};
