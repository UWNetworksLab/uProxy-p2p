// brorand alias which works in a freedomjs module context.
// Uses randombytes, for which we have an alias which works
// for Firefox.

const randombytes = require('randombytes');

module.exports = function rand(len) {
  return randombytes(len);
};

function Rand(fallback) {
  // no-op: always use randombytes
}
module.exports.Rand = Rand;

Rand.prototype.generate = function generate(len) {
  return randombytes(len);
};
