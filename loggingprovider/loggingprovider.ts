/// <reference path='../../third_party/freedom/freedom-common.d.ts' />
/// <reference path='../../third_party/freedom/console.d.ts' />
/// <reference path='../../third_party/freedom/freedom-module-env.d.ts' />

import logging = require('loggingprovider.i');

// The freedom console provider.
var freedomConsole
 :freedom_Console.Console = freedom['core.console']();

// Besides output to console, log can also be buffered for later retrieval
// through "getLogs". This is the maximum number of buffered log before it is
// trimmed. Assuming average log length is 80, the whole buffer size is about
// 80k. That should be easy to send through email, not much memory usage, and
// still enough to capture most issues.
var MAX_BUFFERED_LOG = 1000;

// Logs waiting for the logger to exist.
var logBuffer: logging.Message[] = [];

// TODO: we probably will change it to false as default.
var enabled = true;

// The console filter controls what is displayed in console.
// Entries in the console filter map are of the form:
//   'tag': LEVEL
// It specifies the minimum level of log that will be printed to console for
// module 'tag'. '*' is a wildcard tag that applies to all messages.
var consoleFilter: {[s: string]: string;} = {'*': 'D'};

// Similar to console filter, this filter controls what log is saved to
// internal log buffer, which can be retrieved for diagnosis purpose.
var bufferedLogFilter: {[s: string]: string;} = {'*': 'E'};

// The filter API uses letter to select log level, D for debug, I for info,
// W for warn, and E for error. This string is used to convert from letter
// to level number.
var LEVEL_CHARS = 'DIWE';

// Generates current timestamp in form "m/d H:m:s.S"
function dateToString_(d:Date) : string {
  return d.getMonth() + '/' + d.getDate() + ' ' + d.getHours() +
      ':' + d.getMinutes() + ':' + d.getSeconds() + '.' +
      d.getMilliseconds();
}

function isLevelAllowed_(request:string, permitted:string) : boolean {
  return LEVEL_CHARS.indexOf(request) >= LEVEL_CHARS.indexOf(permitted);
}

export function formatMessage(l:logging.Message) : string {
  return l.level + ' [' + dateToString_(l.timestamp) + '] ' + l.message;
}

export function makeMessage(level:string, tag:string, msg:string)
    : logging.Message {
  return {
    timestamp: new Date(),
    level: level,
    tag: tag,
    message: msg
  };
}

function checkFilter_(level:string, tag:string, filter:{[s: string]: string;})
    : boolean {
  return '*' in filter && isLevelAllowed_(level, filter['*']) ||
         tag in filter && isLevelAllowed_(level, filter[tag]);
}

// Function that actally adds things to the log and does the console output.
export function doRealLog(level:string, tag:string, msg:string)
    : void {
  if (!enabled) { return; }
  var message :logging.Message = makeMessage(level, tag, msg);

  if (checkFilter_(level, tag, consoleFilter)) {
    if(level === 'D') {
      freedomConsole.debug(tag, formatMessage(message));
    } else if(level === 'I') {
      freedomConsole.log(tag, formatMessage(message));
    } else if(level === 'W') {
      freedomConsole.warn(tag, formatMessage(message));
    } else {
      freedomConsole.error(tag, formatMessage(message));
    }
  }

  if (checkFilter_(level, tag, bufferedLogFilter)) {
    if (logBuffer.length > MAX_BUFFERED_LOG) {
      // trim from the head 10 percent each time.
      logBuffer.splice(0, MAX_BUFFERED_LOG / 10);
    }
    logBuffer.push(message);
  }
}

// Interface for accumulating log messages.
export class Log implements logging.Log {
  constructor() {}

  // Logs message in debug level.
  public debug = (source:string, msg: string) : void => {
    doRealLog('D', source, msg);
  }
  // Logs message in info level.
  public info = (source:string, msg: string) : void => {
    doRealLog('I', source, msg);
  }
  public log = (source:string, msg: string) : void => {
    doRealLog('I', source, msg);
  }
  // Logs message in warn level.
  public warn = (source:string, msg: string) : void => {
    doRealLog('W', source, msg);
  }
  // Logs message in error level.
  public error = (source:string, msg: string) : void => {
    doRealLog('E', source, msg);
  }
}

// Interface for managing & retreiving log messages.
// Note: this is really a fake class: all data is in fact global.
// TODO: rename this to LoggingManager or something sensible.
export class LoggingController implements logging.Controller  {
  constructor() {}

  // Gets log as a encrypted blob, which can be transported in insecure
  // channel.
  public getEncrypedLogBuffer = (tags:string[]) : ArrayBuffer => {
    // TODO: to be implemented.
    return new ArrayBuffer(0);
  }

  // Gets log in plaintext, which should really be used in development env
  // only.
  // Usage: getLogs(['network', 'xmpp']);
  // It will return log message with tag 'netowrk' and 'xmpp' only.
  // getLogs() without specify any tag will return all messages.
  public getLogs = (tags?:string[]) : string[] => {
    // TODO: use input to select log message.
    if(!tags || tags.length === 0) {
      return logBuffer.map(formatMessage);
    } else {
      return logBuffer.filter((m:logging.Message) => {
        return tags.indexOf(m.tag) >= 0;
      }).map(formatMessage);
    }
  }

  // Clears all the logs stored in buffer.
  public clearLogs = () : void => {
    logBuffer = [];
  }
  // Enables/Disables log facility.
  public enable = () : void => {
    enabled = true;
  }
  // Enables/Disables log facility.
  public disable = () : void => {
    enabled = false;
  }

  // Sets the log filter for console output. Caller can specify logs of
  // desired tags and levels for console output.
  // Usage example: setConsoleFilter("*:E", "network:D")
  // It means: output message in Error level for any module
  //           output message in debug level and above for "network" module.
  public setConsoleFilter = (args: string[]) : void => {
    consoleFilter = {};
    for (var i = 0; i < args.length; i++) {
      var parts = args[i].split(':');
      consoleFilter[parts[0]] = parts[1];
    }
  }

  // Sets the log filter for buffered log.
  // Usage example: setBufferedLogFilter("*:E", "network:D")
  // It means: buffer message in Error level for any module
  //           buffer message in debug level and above for "network" module.
  public setBufferedLogFilter = (args: string[]) : void => {
    bufferedLogFilter = {};
    for (var i = 0; i < args.length; i++) {
      var parts = args[i].split(':');
      bufferedLogFilter[parts[0]] = parts[1];
    }
  }
}

if (typeof freedom !== 'undefined') {
  freedom().provideSynchronous(Log);
  freedom['loggingcontroller']().provideSynchronous(LoggingController);
}
