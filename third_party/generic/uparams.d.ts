// Type definitions for the uparams module

declare module 'uparams' {
  // The uparams module is itself a function, rather than an object with
  // member functions.
  function uparams(s:string) : any;
  export = uparams;
}
