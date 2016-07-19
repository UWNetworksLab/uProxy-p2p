// Alternative to crypto-browserify's randombytes shim which falls back
// to freedom.js' core.crypto module, if available. For Firefox <48.
//
// Original:
//   https://github.com/crypto-browserify/randombytes

const cryptoAvailable = typeof crypto !== 'undefined';

let coreCrypto;
let bufferedRandomness = new Buffer(0);
let offset = 0;

const refreshBufferedRandomness = function() {
  // 65536 is the maximum value supported by crypto.getRandomValues on Chrome.
  coreCrypto.getRandomBytes(65536).then(function(ab) {
    bufferedRandomness = new Buffer(ab);
    offset = 0;
  }, function(e) {
    console.error('could not generate randomness', e);
  });
}

const getBufferedRandomness = function(size) {
  if (offset + size > bufferedRandomness.length * 0.75) {
    refreshBufferedRandomness();
  }

  if (offset + size > bufferedRandomness.length) {
    throw new Error('insufficient randomness available');
  }

  offset += size;
  return bufferedRandomness.slice(offset, offset + size);
};

if (!cryptoAvailable) {
  try {
    coreCrypto = freedom['core.crypto']();
    refreshBufferedRandomness();
  } catch (e) {
    console.error('crypto and core.crypto unavailable - there can be no randomness in this web worker')
  }
}

module.exports = function(size, cb) {
  if (cryptoAvailable) {
    const buffer = new Buffer(size);
    crypto.getRandomValues(buffer);
    if (cb) {
      cb(undefined, buffer);
    } else {
      return buffer;
    }
  } else {
    if (!coreCrypto) {
      console.warn('randomness requested but unavailable in this web worker')
    } else if (cb) {
      coreCrypto.getRandomBytes(size).then(function(ab) {
        cb(null, new Buffer(ab));
      });
    } else {
      return getBufferedRandomness(size);
    }
  }
};
