// Core log management functionality. For writing log output from code, see
// logging.d.ts.
//

declare module LoggingProvider {
  class Log {
    constructor();
    debug(tag:string, msg:string) : void;
    info(tag:string, msg:string) : void;
    warn(tag:string, msg:string) : void;
    error(tag:string, msg:string) : void;
  }

  // The data structure for a logged message.
  interface Message {
    timestamp :Date; // the timestamp the log was called (in core runtime).
    level :string; // one of D=Debug, I=Info, W=Warning, E=Error
    tag :string; // any string, used for viewing specific module logs.
    message :string; // the actual log message.
  }

  // This is the real internal interface available to other core modules/the
  // top level environment.
  function makeMessage(level:string, tag:string, msg:string)
      : Message;
  function formatMessage(l:Message) : string;
  function doRealLog(level:string, tag:string, msg:string) : void;
  function getEncrypedLogBuffer(tags?:string[]) : ArrayBuffer;
  function getLogs(tags?:string[]) : string[];
  function clearLogs() : void;
  function enable() : void;
  function disable() : void;
  function setConsoleFilter(args:string[]) : void;
  function setBufferedLogFilter(args:string[]) : void;
}
