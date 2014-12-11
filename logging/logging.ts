/// <reference path='../freedom/typings/freedom.d.ts' />

module Logging {
  // Created freedom.js loggers
  var loggers :{[tag:string]:freedom.Logger} = {};

  // Messages waiting on a logger.
  interface Msg {
    level:string
    msg:string
  }
  var waiters :{[tag:string]:Msg[]} = {};

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

  function doLog(level:string, tag:string, msg:string, args?:any[]) : void {
    if (tag in loggers) {
      var logger = loggers[tag];
      var realLog = (msg:string) => {};

      if (level === 'debug') {
        realLog = logger.debug;
      } else if (level === 'info') {
        realLog = logger.info;
      } else if (level === 'warn') {
        realLog = logger.warn;
      } else if (level === 'error') {
        realLog = logger.error;
      }
      
      return realLog(formatStringMessageWithArgs_(msg, args));
    }
    if (!(tag in waiters)) {
      waiters[tag] = [];
    }
    waiters[tag].push({level: level, msg: formatStringMessageWithArgs_(msg, args)});
  }
  
  function registerLogger(tag:string, logger:freedom.Logger) : void {
    loggers[tag] = logger;
    if (tag in waiters) {
      for (var i = 0; i < waiters[tag].length; i += 1) {
        var msg:Msg = waiters[tag][i];
        doLog(msg.level, tag, msg.msg);
      }
      delete waiters[tag];
    }
  }

  export class Log {
    constructor(private tag_:string) {
      freedom['core']().getLogger(this.tag_).then((logger:freedom.Logger) => {
        registerLogger(this.tag_, logger);
      });
    }
    // Logs message in debug level.
    public debug = (msg: string, args?:any[]) : void => {
      doLog('debug', this.tag_, msg, args);
    }
    // Logs message in info level.
    public info = (msg: string, args?:any[]) : void => {
      doLog('info', this.tag_, msg, args);
    }
    // Logs message in warn level.
    public warn = (msg: string, args?:any[]) : void => {
      doLog('warn', this.tag_, msg, args);
    }
    // Logs message in error level.
    public error = (msg: string, args?:any[]) : void => {
      doLog('error', this.tag_, msg, args);
    }
  }
}


