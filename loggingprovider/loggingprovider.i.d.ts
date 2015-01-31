export interface Message {
  timestamp :Date; // the timestamp the log was called (in core runtime).
  level :string; // one of D=Debug, I=Info, W=Warning, E=Error
  tag :string; // any string, used for viewing specific module logs.
  message :string; // the actual log message.
}

// Interface for accumulating log messages.
export interface Log {
  // Logs message in debug level.
  debug(source:string, msg: string) : void;
  // Logs message in info level.
  info(source:string, msg: string) : void;
  log(source:string, msg: string) : void;
  // Logs message in warn level.
  warn(source:string, msg: string) : void;
  // Logs message in error level.
  error(source:string, msg: string) : void;
}

// Interface for managinge & retreiving log messages.
// Note: this is really a fake class: all data is in fact global.
export interface Controller {
  getEncrypedLogBuffer(tags:string[]) : ArrayBuffer;

  // Gets log in plaintext, which should really be used in development env
  // only.
  // Usage: getLogs(['network', 'xmpp']);
  // It will return log message with tag 'netowrk' and 'xmpp' only.
  // getLogs() without specify any tag will return all messages.
  getLogs(tags?:string[]) : string[];

  // Clears all the logs stored in buffer.
  clearLogs() : void;
  // Enables/Disables log facility.
  enable() : void;
  // Enables/Disables log facility.
  disable() : void;

  // Sets the log filter for console output. Caller can specify logs of
  // desired tags and levels for console output.
  // Usage example: setConsoleFilter("*:E", "network:D")
  // It means: output message in Error level for any module
  //           output message in debug level and above for "network" module.
  setConsoleFilter(args: string[]) : void;

  // Sets the log filter for buffered log.
  // Usage example: setBufferedLogFilter("*:E", "network:D")
  // It means: buffer message in Error level for any module
  //           buffer message in debug level and above for "network" module.
  setBufferedLogFilter(args: string[]) : void;
}

export interface LoggingProviderModule {
  formatMessage(l:Message) : string;
  makeMessage(level:string, tag:string, msg:string) : Message;
  doRealLog(level:string, tag:string, msg:string) : void;
}
