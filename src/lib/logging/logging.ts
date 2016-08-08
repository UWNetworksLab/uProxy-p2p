/// <reference path='../../../third_party/typings/index.d.ts' />

import loggingProviderTypes = require('../loggingprovider/loggingprovider.types');
import CircularJSON = require('circular-json');

declare const freedom: freedom.FreedomInModuleEnv;

// Perform log message formatting. Formats an array of arguments to a
// single string.
// TODO: move this into the provider.
function formatStringMessageWithArgs_(args :Object[])
    : string {
  var msg = '';

  for (var i = 0; i < args.length; i++) {
    var arg = args[i];
    if ('string' !== typeof(arg) && !(arg instanceof String)) {
      try {
        arg = CircularJSON.stringify(arg);
      } catch (e) {
        if (arg && typeof(arg.toString) === 'function') {
          arg = arg.toString();
        } else {
          arg = e.message;
        }
      }
    }

    if (-1 !== msg.indexOf('%' + i)) {
      msg = msg.replace('%' + i, <string>arg);
    } else {
      if (msg.length > 0) {
        msg += ' ';
      }
      msg += arg;
    }
  }

  return msg;
}

export class Log {
  private logger :Promise<freedom.Logger>;

  // the minimum level at which we will issue IPCs for logging statements
  private minLevel :loggingProviderTypes.Level = loggingProviderTypes.Level.debug;

  constructor(private tag_:string) {
    this.logger = freedom.core().getLogger(this.tag_);

    if (freedom['logginglistener']) {
      freedom['logginglistener'](this.tag_).on('levelchange', this.setMinLevel_);
    } else {
      this.warn('Freedom module logginglistener is not available, IPCs will ' +
                'be issued for all logging statements');
    }
  }

  private setMinLevel_ = (level :loggingProviderTypes.Level) => {
    this.minLevel = level;
  }

  private shouldLog_ = (level :loggingProviderTypes.Level) => {
    return level >= this.minLevel;
  }

  private log_ = (level :loggingProviderTypes.Level, arg :Object, args :Object[]) :void => {
    if (!this.shouldLog_(level)) {
      return;
    }

    // arg exists to make sure at least one argument is given, we want to treat
    // all the arguments as a single array however
    args.unshift(arg);

    if (2 === args.length &&
        ('string' === typeof(args[0]) || args[0] instanceof String) &&
        Array.isArray(args[1])) {
      args = [args[0]].concat((<Object[]>args[1]).slice());
    }

    var message = formatStringMessageWithArgs_(args);

    this.logger.then((logger :freedom.Logger) => {
      // essentially do logger[loggingProviderTypes.Level[level]](message) minus the type warning
      switch (level) {
        case loggingProviderTypes.Level.debug:
          return logger.debug(message);
        case loggingProviderTypes.Level.info:
          return logger.info(message);
        case loggingProviderTypes.Level.warn:
          return logger.warn(message);
        case loggingProviderTypes.Level.error:
          return logger.error(message);
      }
    });
  }

  // Logs message in debug level.
  public debug = (arg :Object, ...args :Object[]) :void => {
    this.log_(loggingProviderTypes.Level.debug, arg, args);
  }
  // Logs message in info level.
  public info = (arg :Object, ...args :Object[]) :void => {
    this.log_(loggingProviderTypes.Level.info, arg, args);
  }
  // Logs message in warn level.
  public warn = (arg :Object, ...args :Object[]) :void => {
    this.log_(loggingProviderTypes.Level.warn, arg, args);
  }
  // Logs message in error level.
  public error = (arg :Object, ...args :Object[]) :void => {
    this.log_(loggingProviderTypes.Level.error, arg, args);
  }
}
