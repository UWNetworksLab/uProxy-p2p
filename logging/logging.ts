/// <reference path='../freedom/typings/freedom.d.ts' />
/// <reference path='../freedom/typings/console.d.ts' />

module Logging {

  // The data structure for a logged message.
  export interface Message {
    timestamp :Date; // the timestamp the log was called (in core runtime).
    level :string; // one of D=Debug, I=Info, W=Warning, E=Error
    tag :string; // any string, used for viewing specific module logs.
    message :string; // the actual log message.
  }

  // Besides output to console, log can also be buffered for later retrieval
  // through "getLogs". This is the maximum number of buffered log before it is
  // trimmed. Assuming average log length is 80, the whole buffer size is about
  // 80k. That should be easy to send through email, not much memory usage, and
  // still enough to capture most issues.
  var MAX_BUFFERED_LOG = 1000;

  var consoleLogger :freedom_Console.Console = freedom['core.console']();

  var logBuffer: Message[] = [];

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

  // Perform log message formatting. This method is set to public for
  // testing purpose. The function is not exposed in as freedom module API.
  function formatStringMessageWithArgs_(msg:string, args?:any[])
      : string {
    var formatted_msg = msg;
    if (args && args.length) {
      for (var i = 0; i < args.length; i++) {
        formatted_msg = formatted_msg.replace('%' + (i + 1), args[i]);
      }
    }
    return formatted_msg;
  }

  export function formatMessage(l:Message) : string {
    return l.level + ' [' + dateToString_(l.timestamp) + '] ' + l.message;
  }

  export function makeMessage(level:string, tag:string, msg:string, args?:any[]) : Message {
    return {
      timestamp: new Date(),
      level: level,
      tag: tag,
      message: formatStringMessageWithArgs_(msg, args)
    };
  }

  function checkFilter_(level:string, tag:string, filter:{[s: string]: string;})
      : boolean {
    return '*' in filter && isLevelAllowed_(level, filter['*']) ||
           tag in filter && isLevelAllowed_(level, filter[tag]);
  }

  // Function that actally adds things to the log and does the console output.
  export function doRealLog(level:string, tag:string, msg:string, args?:any[])
      : void {
    if (!enabled) { return; }
    var Message :Message = makeMessage(level, tag, msg, args);

    if (checkFilter_(level, tag, consoleFilter)) {
      if(level === 'D' || level === 'I') {
        consoleLogger.log(tag, formatMessage(Message));
      } else if(level === 'W') {
        consoleLogger.warn(tag, formatMessage(Message));
      } else {
        consoleLogger.error(tag, formatMessage(Message));
      }
    }

    if (checkFilter_(level, tag, bufferedLogFilter)) {
      if (logBuffer.length > MAX_BUFFERED_LOG) {
        // trim from the head 10 percent each time.
        logBuffer.splice(0, MAX_BUFFERED_LOG / 10);
      }
      logBuffer.push(Message);
    }
  }

  // Gets log as a encrypted blob, which can be transported in insecure
  // channel.
  export function getEncrypedLogBuffer(tags:string[]) : ArrayBuffer {
    // TODO: to be implemented.
    return new ArrayBuffer(0);
  }

  // Gets log in plaintext, which should really be used in development env
  // only.
  // Usage: getLogs(['network', 'xmpp']);
  // It will return log message with tag 'netowrk' and 'xmpp' only.
  // getLogs() without specify any tag will return all messages.
  export function getLogs(tags?:string[]) : string[] {
    // TODO: use input to select log message.
    if(!tags || tags.length === 0) {
      return logBuffer.map(formatMessage);
    } else {
      return logBuffer.filter((m:Message) => {
        return tags.indexOf(m.tag) >= 0;
      }).map(formatMessage);
    }
  }

  // Clears all the logs stored in buffer.
  export function clearLogs() : void {
    logBuffer = [];
  }
  // Enables/Disables log facility.
  export function enable() : void {
    enabled = true;
  }
  // Enables/Disables log facility.
  export function disable() : void {
    enabled = false;
  }

  // Sets the log filter for console output. Caller can specify logs of
  // desired tags and levels for console output.
  // Usage example: setConsoleFilter("*:E", "network:D")
  // It means: output message in Error level for any module
  //           output message in debug level and above for "network" module.
  export function setConsoleFilter(args: string[]) : void {
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
  export function setBufferedLogFilter(args: string[]) : void {
    bufferedLogFilter = {};
    for (var i = 0; i < args.length; i++) {
      var parts = args[i].split(':');
      bufferedLogFilter[parts[0]] = parts[1];
    }
  }

  export class Log {
    constructor(private tag_:string) {}
    // Logs message in debug level.
    public debug = (msg: string, args?:any[]) : void => {
      doRealLog('D', this.tag_, msg, args);
    }
    // Logs message in info level.
    public info = (msg: string, args?:any[]) : void => {
      doRealLog('I', this.tag_, msg, args);
    }
    // Logs message in warn level.
    public warn = (msg: string, args?:any[]) : void => {
      doRealLog('W', this.tag_, msg, args);
    }
    // Logs message in error level.
    public error = (msg: string, args?:any[]) : void => {
      doRealLog('E', this.tag_, msg, args);
    }
  }
}


