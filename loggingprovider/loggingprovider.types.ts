export interface Message {
  timestamp :Date; // the timestamp the log was called (in core runtime).
  level :Level;
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

  setDefaultFilter(destination :Destination, level :Level) :void;

  setFilters(destination :Destination,
                   filters :{[tag :string] :Level}) :void;

  setFilter(destination :Destination, tag :string, level?:Level) :void;
}

export interface Listener {
}

export enum Level {
  debug,
  info,
  warn,
  error
}

export enum Destination {
  console,
  buffered
}
