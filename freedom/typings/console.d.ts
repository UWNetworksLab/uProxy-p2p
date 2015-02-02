// Typescript file for core.console in:
// https://github.com/freedomjs/freedom/blob/master/interface/core.console.json
/// <reference path="../../../build/third_party/typings/es6-promise/es6-promise.d.ts" />

declare module freedom_Console {
  interface Console {
    log(source:string, message:string) : Promise<void>;
    debug(source:string, message:string) : Promise<void>;
    info(source:string, message:string) : Promise<void>;
    warn(source:string, message:string) : Promise<void>;
    error(source:string, message:string) : Promise<void>;
  }
}
