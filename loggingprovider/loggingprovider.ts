/// <reference path='../../../third_party/freedom-typings/console.d.ts' />
/// <reference path='../../../third_party/freedom-typings/freedom-common.d.ts' />
/// <reference path='../../../third_party/freedom-typings/freedom-module-env.d.ts' />

import logging = require('loggingprovider.types');

// The freedom console provider.
var freedomConsole :freedom_Console.Console = freedom['core.console']();

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

// This represents a possible destination for log messages.  To make use of
// this, the class should be inherited from and the log_ method reimplemented
// to record the message in whichever way is best for that transport.
class AbstractLoggingDestination {
  // These filters control what is displayed/saved for the different log types.
  // Entries for each type should be of the form:
  //   'tag': LEVEL
  // where LEVEL is the minimum level of log that will be processed for the
  // module 'tag'.  '*' is a wildcard tag that applies to any message that is not
  // specifically specified
  private filters_ :{[tag :string] :string} = {};

  constructor(filters :{[tag :string] :string}) {
    this.filters_ = filters;
  }

  private checkFilter_ = (level :string, tag :string) => {
    if (tag in this.filters_) {
      return isLevelAllowed_(level, this.filters_[tag]);
    }

    return '*' in this.filters_ && isLevelAllowed_(level, this.filters_['*']);
  }

  protected log_ = (level :string, tag :string, message :logging.Message) :void => {
    throw Error('not implemented');
  }

  public log = (level :string, tag :string, message :logging.Message) :void => {
    if (this.checkFilter_(level, tag)) {
      this.log_(level, tag, message);
    }
  }

  public setFilter = (args :string[]) => {
    this.filters_ = {};
    var parts :string[];

    for (var i in args) {
      parts = args[i].split(':');
      this.filters_[parts[0]] = parts[1];
    }
  }
}

// A logging destination for printing the message directly to the console
class ConsoleLoggingDestination extends AbstractLoggingDestination {
  constructor() {
    super({'*': 'D'});
  }

  protected log_ = (level :string, tag :string, message :logging.Message) :void => {
    if (level === 'D') {
      freedomConsole.debug(tag, formatMessage(message));
    } else if (level === 'I') {
      freedomConsole.log(tag, formatMessage(message));
    } else if (level === 'W') {
      freedomConsole.warn(tag, formatMessage(message));
    } else {
      freedomConsole.error(tag, formatMessage(message));
    }
  }
}

class BufferedLoggingDestination extends AbstractLoggingDestination {
  constructor() {
    super({'*': 'E'});
  }

  protected log_ = (level :string, tag :string, message :logging.Message) :void => {
    if (logBuffer.length > MAX_BUFFERED_LOG) {
      logBuffer.splice(0, MAX_BUFFERED_LOG / 10);
    }
    logBuffer.push(message);
  }
}

var loggingDestinations :{[name :string] :AbstractLoggingDestination} = {};
var logDestination = {
  CONSOLE: 'console',
  BUFFERED: 'buffered'
};
loggingDestinations[logDestination.BUFFERED] =
  new BufferedLoggingDestination();
loggingDestinations[logDestination.CONSOLE] =
  new ConsoleLoggingDestination();

// The filter API uses letter to select log level, D for debug, I for info,
// W for warn, and E for error. This string is used to convert from letter
// to level number.
var LEVEL_CHARS = 'DIWE';

var MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Generates current timestamp in form "M d H:m:s.S"
function dateToString_(d:Date) : string {
  return MONTH_NAMES[d.getMonth()] + ' ' + d.getDate() + ' ' +
      (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' +
      (d.getMinutes() < 10 ? '0' : '') + d.getMinutes() + ':' +
      (d.getSeconds() < 10 ? '0' : '') + d.getSeconds() + '.' +
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

// Function that actally adds things to the log and does the console output.
export function doRealLog(level:string, tag:string, msg:string)
    : void {
  if (!enabled) { return; }
  var message :logging.Message = makeMessage(level, tag, msg);

  for (var i in loggingDestinations) {
    loggingDestinations[i].log(level, tag, message);
  }
}

// Interface for accumulating log messages.
export class Log implements logging.Log {

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
    if (!tags || tags.length === 0) {
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
    loggingDestinations[logDestination.CONSOLE].setFilter(args);
  }

  // Sets the log filter for buffered log.
  // Usage example: setBufferedLogFilter("*:E", "network:D")
  // It means: buffer message in Error level for any module
  //           buffer message in debug level and above for "network" module.
  public setBufferedLogFilter = (args: string[]) : void => {
    loggingDestinations[logDestination.BUFFERED].setFilter(args);
  }
}
