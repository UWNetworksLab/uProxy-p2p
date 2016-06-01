/// <reference path='../typings/browser.d.ts' />

// TypeScript definitions for browserify-zlib:
//   https://github.com/devongovett/browserify-zlib
//
// Note that this is a tiny fraction of available
// methods; for a reference, see the Node.js zlib
// documentation.

declare module 'browserify-zlib' {
  function gzipSync(buffer:Buffer) : Buffer;
  function gunzipSync(buffer:Buffer) : Buffer;
}
