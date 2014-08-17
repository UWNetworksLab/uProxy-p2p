// Core log management functionality. For writing log output from code, see
// log.d.ts.
//
// All timestamps are in the core environments runtime.
//
// CONSIDER: better to have date done by the caller? Then you get real timings
// without the message-passing delay which could be really confusing on race-
// condition debugging.
declare module Logging {
  // Example use for a core-provider or core runtime code that uses it:
  // var logger :Logging.Logger = new Logging.Log('my_tag');
  class Log {
    constructor(tag_:string);
    debug(msg:string, args?:any[]) : void;
    info(msg:string, args?:any[]) : void;
    warn(msg:string, args?:any[]) : void;
    error(msg:string, args?:any[]) : void;
  }

  // This is the real internal interface available to other core modules/the
  // top level environment.
  function makeMessage(level:string, tag:string, msg:string, args?:any[])
      : Message;
  function formatMessage(l:Message) : string;
  function doRealLog(level:string, tag:string, msg:string, args?:any[]) : void;
  function getEncrypedLogBuffer(tags?:string[]) : ArrayBuffer;
  function getLogs(tags?:string[]) : string[];
  function clearLogs() : void;
  function enable() : void;
  function disable() : void;
  function setConsoleFilter(args:string[]) : void;

  // The data structure for a logged message.
  interface Message {
    timestamp :Date; // the timestamp the log was called (in core runtime).
    level :string; // one of D=Debug, I=Info, W=Warning, E=Error
    tag :string; // any string, used for viewing specific module logs.
    message :string; // the actual log message.
  }
}
