/// <reference path='../../build/third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../build/third_party/freedom-typings/freedom-module-env.d.ts' />

import freedomTypes = require('freedom.types');

// Perform log message formatting. Formats an array of arguments to a
// single string.
// TODO: move this into the provider.
function formatStringMessageWithArgs_(args :Object[])
    : string {
  var msg = '';

  for (var i = 0; i < args.length; i++) {
    var arg = args[i];
    if ('string' !== typeof(arg) && !(arg instanceof String)) {
      arg = JSON.stringify(arg);
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
  private logger :Promise<freedomTypes.Logger>;
  constructor(private tag_:string) {
    this.logger = freedom.core().getLogger(this.tag_);
  }

  private log_ = (level :string, arg :Object, args :Object[]) :void => {
    // arg exists to make sure at least one argument is given, we want to treat
    // all the arguments as a single array however
    args.unshift(arg);

    if (2 === args.length &&
        ('string' === typeof(args[0]) || args[0] instanceof String) &&
        Array.isArray(args[1])) {
      args = [args[0]].concat((<Object[]>args[1]).slice());
    }

    var message = formatStringMessageWithArgs_(args);

    this.logger.then((logger :freedomTypes.Logger) => {
      // essentially do logger[level](message) minus the type warning
      switch (level) {
        case 'debug':
          return logger.debug(message);
        case 'info':
          return logger.info(message);
        case 'warn':
          return logger.warn(message);
        case 'error':
          return logger.error(message);
      }
    });
  }

  // Logs message in debug level.
  public debug = (arg :Object, ...args :Object[]) :void => {
    this.log_('debug', arg, args);
  }
  // Logs message in info level.
  public info = (arg :Object, ...args :Object[]) :void => {
    this.log_('info', arg, args);
  }
  // Logs message in warn level.
  public warn = (arg :Object, ...args :Object[]) :void => {
    this.log_('warn', arg, args);
  }
  // Logs message in error level.
  public error = (arg :Object, ...args :Object[]) :void => {
    this.log_('error', arg, args);
  }
}
