// Type definitions for the md5 module

declare module 'md5' {
  // The md5 module is itself a function, rather than an object with
  // member functions.
  function md5(s:string) : string;
  export = md5;
}
