/// <reference path="../../../third_party/typings/es6-promise/es6-promise.d.ts" />
/// <reference path="../../../logging/logging.d.ts" />

declare module Freedom_UproxyLogging {

  // This is the Freedom LogManager core provider that lets freedom modules
  // access the logger's core functions.
  //
  // Example of use:
  //
  // var logManager :Freedom_UproxyLogging.LogManager =
  //     freedom['core.logmanager']();
  interface LogManager {
    getEncrypedLogBuffer(tags?:string[]) : Promise<ArrayBuffer>;
    getLogs(tags?:string[]) : Promise<Logging.Message[]>;
    getLogStrings(tags?:string[]) : Promise<string[]>;
    clearLogs() : void;
    enable() : void;
    disable() : void;
    setConsoleFilter(args:string[]) : void;
  }

  // Example use for a provider that depends on this core provider:
  //
  // var logger :Freedom_UproxyLogging.Logger =
  //     freedom['core.logger']('my_tag');
  class Log {
    // constructor(tag_:string);
    debug(msg:string, args?:any[]) : void;
    info(msg:string, args?:any[]) : void;
    warn(msg:string, args?:any[]) : void;
    error(msg:string, args?:any[]) : void;
  }
}
