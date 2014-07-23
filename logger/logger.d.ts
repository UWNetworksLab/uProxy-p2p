/// <reference path="../third_party/typings/es6-promise/es6-promise.d.ts" />

// This is the interface that a module that has logger as a dependency gets to
// use.
interface LogProvider {
   getEncrypedLogBuffer(...tags: string[]) : Promise<ArrayBuffer>;
   getLogs(...tags: string[]) : Promise<string>;
   reset() : Promise<void>;
   enable(newState: boolean) : Promise<void>;
   format(level: string, tag: string, msg: string, args: string[]) : string;
   setConsoleFilter(...args: string[]) : Promise<void>;
   debug(tag: string, msg: string, ...args: any[]) : Promise<void>;
   info(tag: string, msg: string, ...args: any[]) : Promise<void>;
   warn(tag: string, msg: string, ...args: any[]) : Promise<void>;
   error(tag: string, msg: string, ...args: any[]) : Promise<void>;
}

// TODO: add this again once https://github.com/Microsoft/TypeScript/issues/52
// is fixed.
//
//declare module freedom {
//    function Logger(): LogProvider;
//}
