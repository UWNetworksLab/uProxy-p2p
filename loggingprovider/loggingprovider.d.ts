// Core log management functionality. For writing log output from code, see
// logging.d.ts.
//

declare module LoggingProvider {
  // This interface accepts logs from other modules.
  class Log {
    constructor();
    debug(tag:string, msg:string) : void;
    info(tag:string, msg:string) : void;
    warn(tag:string, msg:string) : void;
    error(tag:string, msg:string) : void;
  }

  // This interface allows control of logging behavior.
  class LoggingProvider {
    getEncrypedLogBuffer(tags?:string[]) : ArrayBuffer;
    getLogs(tags?:string[]) : string[];
    clearLogs() : void;
    enable() : void;
    disable() : void;
    setConsoleFilter(args:string[]) : void;
    setBufferedLogFilter(args:string[]) : void;
  }

  // The data structure for buffering log messages.
  interface Message {
    timestamp :Date; // the timestamp the log was called (in core runtime).
    level :string; // one of D=Debug, I=Info, W=Warning, E=Error
    tag :string; // any string, used for viewing specific module logs.
    message :string; // the actual log message.
  }

  // Internal functions for formatting logs.
  function makeMessage(level:string, tag:string, msg:string)
      : Message;
  function formatMessage(l:Message) : string;
  function doRealLog(level:string, tag:string, msg:string) : void;
}
