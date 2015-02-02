/// <reference path='../../build/third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../freedom/typings/freedom-module-env.d.ts' />

import freedomTypes = require('freedom.types');
//import freedom = require('../freedom/freedom-module-env');

// Perform log message formatting. Formats an array of arguments to a
// single string.
// TODO: switch to rest arguments.
// TODO: move this into the provider.
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

interface loggable {
  (logger: freedomTypes.Logger): void;
}

function doLog(level:string, msg:string, args?:any[]) : loggable {
  var message = formatStringMessageWithArgs_(msg, args);

  return (logger: freedomTypes.Logger) => {
    if (level === 'debug') {
      logger.debug(message);
    } else if (level === 'info') {
      logger.info(message);
    } else if (level === 'warn') {
      logger.warn(message);
    } else if (level === 'error') {
      logger.error(message);
    }
  };
}

export class Log {
  private logger :Promise<freedomTypes.Logger>;
  constructor(private tag_:string) {
    this.logger = freedom.core().getLogger(this.tag_);
  }
  // Logs message in debug level.
  public debug = (msg: string, args?:any[]) : void => {
    this.logger.then(doLog('debug', msg, args));
  }
  // Logs message in info level.
  public info = (msg: string, args?:any[]) : void => {
    this.logger.then(doLog('info', msg, args));
  }
  // Logs message in warn level.
  public warn = (msg: string, args?:any[]) : void => {
    this.logger.then(doLog('warn', msg, args));
  }
  // Logs message in error level.
  public error = (msg: string, args?:any[]) : void => {
    this.logger.then(doLog('error', msg, args));
  }
}
