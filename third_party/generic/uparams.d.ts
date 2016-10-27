// Type definitions for the uparams module
// TODO: remove uparams as it doesn't work with ES6 imports and TypeScript,
// see https://github.com/uProxy/uproxy/issues/2782

declare module 'uparams' {
  // The uparams module is itself a function, rather than an object with
  // member functions.
  function uparams(s:string) : any;
  export = uparams;
}
