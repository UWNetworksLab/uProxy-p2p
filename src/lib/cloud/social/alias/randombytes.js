// Alternative to crypto-browserify's randombytes shim which
// falls back to Math.random when crypto.getRandomValues is
// unavailable, which is currently the case in Firefox web workers.
// TODO: Fallback to something better such as freedomjs' core.crypto
//       module (difficult because it is an asynchronous API).

// Firefox raises an error if we so much as even try
// to *access* crypto, hence this bizarre construction.
var cryptoAvailable = true;
try {
  if (crypto) {}
} catch(e) {
  console.warn('crypto unavailable, falling back to Math.random');
  cryptoAvailable = false;
}

module.exports = function(size, cb) {
  var buffer = new Buffer(size);
  if (cryptoAvailable) {
    // Although this looks weird, it's how crypto-browserify does it too:
    //   https://github.com/crypto-browserify/randombytes/blob/master/browser.js
    crypto.getRandomValues(buffer);
  } else {
    for (var i = 0; i < size; i++) {
      buffer[i] = Math.floor(Math.random() * 256);
    }
  }
  if (cb) {
    cb(undefined, buffer);
  } else {
    return buffer;
  }
}
