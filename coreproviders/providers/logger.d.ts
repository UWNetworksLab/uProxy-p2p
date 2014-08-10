/// <reference path="../../third_party/typings/es6-promise/es6-promise.d.ts" />

// These live in UproxyLogging module, and are provided as a freedom core
// providers. Note: because the definition of these modules is interpreted and
// remotely provided by Freedom, the interfaces in ../logger.ts looks quite
// different. In particular, continuation functions get interpretted as Promise
// results.
//
// All timestamps are in the core environments runtime.
//
// CONSIDER: better to have date done by the caller? Then you get real timings
// without the message-passing delay which could be really confusing on race-
// condition debugging.
declare module UproxyLogging {

  // The data structure for a logged message.
  interface Message {
    timestamp :Date; // the timestamp the log was called (in core runtime).
    level :string; // one of D=Debug, I=Info, W=Warning, E=Error
    tag :string; // any string, used for viewing specific module logs.
    message :string; // the actual log message.
  }

  // This is the real internal interface available to other core modules/the
  // top level environment.
  function makeMessage(level:string, tag:string, msg:string, args?:any[])
      : Message;
  function formatMessage(l:Message) : string;
  function doRealLog(level:string, tag:string, msg:string, args?:any[]) : void;
  function getEncrypedLogBuffer(tags?:string[]) : ArrayBuffer;
  function getLogs(tags?:string[]) : Message[];
  function getLogStrings(tags?:string[]) : string[];
  function clearLogs() : void;
  function enable() : void;
  function disable() : void;
  function setConsoleFilter(args:string[]) : void;

  // This is the Freedom LogManager core provider that lets freedom modules
  // access the logger's core functions.
  //
  // Example of use:
  // var logManager :UproxyLogging.FreedomLogManager =
  //    freedom['core.logmanager']();
  interface FreedomLogManager {
    getEncrypedLogBuffer(tags?:string[]) : Promise<ArrayBuffer>;
    getLogs(tags?:string[]) : Promise<Message[]>;
    getLogStrings(tags?:string[]) : Promise<string[]>;
    clearLogs() : void;
    enable() : void;
    disable() : void;
    setConsoleFilter(args:string[]) : void;
  }

  // Example use for a provider that depends on this core provider:
  // var logger :UproxyLogging.Logger = freedom['core.logger']('my_tag');
  //
  // Example use for a core-provider or core runtime code that uses it:
  // var logger :UproxyLogging.Logger =
  //   new UproxyLogging.Log('my_tag');
  class Log {
    constructor(tag_:string);
    debug(msg:string, args?:any[]) : void;
    info(msg:string, args?:any[]) : void;
    warn(msg:string, args?:any[]) : void;
    error(msg:string, args?:any[]) : void;
  }
}
