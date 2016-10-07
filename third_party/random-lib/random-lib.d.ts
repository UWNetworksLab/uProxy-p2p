// TypeScript definitions for random-lib:
//   https://github.com/fardog/node-random-lib
//
// Note that there are other functions in random-lib; this is
// just what's needed by uproxy-lib.

declare module 'random-lib' {
  function randomInt(options?: {
    min?: number; // Minimum bound, inclusive.
    max?: number; // Maximum bound, exclusive.
  }, callback?: (e: Error, result: number) => any): number;

  function randomFloat(options?: {},
      callback?: (e: Error, result: number) => any): number;
}
