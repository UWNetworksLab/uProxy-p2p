
module UproxyLogging {

  // The data structure for a logged message.
  export interface Message {
    timestamp :Date; // the timestamp the log was called (in core runtime).
    level :string; // one of D=Debug, I=Info, W=Warning, E=Error
    tag :string; // any string, used for viewing specific module logs.
    message :string; // the actual log message.
  }

  var logBuffer: Message[] = [];
  var enabled = true;   // TODO: we probably will change it to false as default.

  // The console filter defines what gets logged, depending on the tags. There
  // is a special '*' tag that applies to all messages.
  // Entries in the console filter map are of the form:
  //   'tag': LEVEL
  // And they signify which tag gets printed at what level of debug printing.
  var consoleFilter: {[s: string]: string;} = {'*': 'D'};

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
    return [dateToString_(l.timestamp), l.tag, l.level, l.message].join('|');
  }

  export function makeMessage(level:string, tag:string, msg:string, args?:any[]) : Message {
    return { timestamp: new Date(),
        level: level,
        tag: tag,
        message: formatStringMessageWithArgs_(msg, args)
      };
  }
  // Function that actally adds things to the log and does the console output.
  export function doRealLog(level:string, tag:string, msg:string, args?:any[])
      : void {
    if (!enabled) { return; }
    var Message :Message = makeMessage(level, tag, msg, args);

    if ('*' in consoleFilter &&
        this.isLevelAllowed_(level, consoleFilter['*']) ||
        tag in consoleFilter &&
        this.isLevelAllowed_(level, consoleFilter[tag])) {
      console.log(formatMessage(Message));
    }
    logBuffer.push(Message);
  }
  // Gets log as a encrypted blob, which can be transported in insecure
  // channel.
  export function getEncrypedLogBuffer(tags:string[]) : ArrayBuffer {
    // TODO: to be implemented.
    return new ArrayBuffer(0);
  }
  export function getLogs(tags?:string[]) : Message[] {
    // TODO: use input to select log message.
    if(!tags || tags.length === 0) {
      return logBuffer
    } else {
      return logBuffer.filter((m:Message) => {
        return tags.indexOf(m.tag) >= 0;
      });
    }
  }
  // Gets log in plaintext, which should really be used in development env
  // only.
  // Usage: getLogs(['network', 'xmpp']);
  // It will return log message with tag 'netowrk' and 'xmpp' only.
  // getLogs() without specify any tag will return all messages.
  export function getLogStrings(tags?:string[]) : string[] {
    // TODO: use input to select log message.
    return getLogs(tags).map(formatMessage);
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
  // It means: output message in Error level for with any tag
  //           output message serious than debug level with "network" tag.
  export function setConsoleFilter(args: string[]) : void {
    consoleFilter = {};
    for (var i = 0; i < args.length; i++) {
      var parts = args[i].split(':');
      consoleFilter[parts[0]] = parts[1];
    }
  }

  // Class for managing logging and exporting logs.
  export class FreedomLogManager {
    // Dummy consturctor because freedom needs one.
    constructor(
      private module_:any,  // TODO: fix `any` type.
      // dispatchEvent_ is never used, hense void eventData.
      private dispatchEvent_:(eventType:string, eventData:void) => void) {}
    //
    public getEncrypedLogBuffer = (tags:string[],
        continuation:(encryptedLogs:ArrayBuffer) => void) : void => {
      continuation(getEncrypedLogBuffer(tags));
    }
    public getLogs = (tags:string[], continuation:(logs:Message[])=>void)
        : void => {
      continuation(getLogs(tags));
    }
    public clearLogs = (continuation:()=>void) : void => {
      clearLogs(); continuation();
    }
    public enable = (continuation:()=>void) : void => {
      enable(); continuation();
    }
    public disable = (continuation:()=>void) : void => {
      disable(); continuation();;
    }
    public setConsoleFilter = (args: string[], continuation:()=>void)
        : void => {
      setConsoleFilter(args); continuation();
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

  // Class for writing to log.
  export class FreedomLogger {
    private logger_ :Log;
    constructor(
        // module_ is never used.
        private module_:any,  // TODO: fix `any` type.
        // dispatchEvent_ is never used, hense void eventData.
        private dispatchEvent_:(eventType:string, eventData:void) => void,
        // The |defaultTag_| is
        private tag_:string) {
      this.logger_ = new Log(tag_);
    }
    public debug = (msg:string, args:any[], continuation:()=>void)
        : void => {
      this.logger_.debug(msg, args); continuation();
    }
    public info = (msg:string, args:any[], continuation:()=>void)
        : void => {
      this.logger_.debug(msg, args); continuation();
    }
    public warn = (msg:string, args:any[], continuation:()=>void)
        : void => {
      this.logger_.debug(msg, args); continuation();
    }
    public error = (msg:string, args:any[], continuation:()=>void)
        : void => {
      this.logger_.debug(msg, args); continuation();
    }
  }

}
