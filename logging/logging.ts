/// <reference path='../../build/third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../build/third_party/freedom-typings/freedom-module-env.d.ts' />

import freedomTypes = require('freedom.types');

// Perform log message formatting. Formats an array of arguments to a
// single string.
// TODO: move this into the provider.
function formatStringMessageWithArgs_(args :any[])
    : string {
  var msg = '';
  var arg :any;

  for (var i = 0; i < args.length; i++) {
    arg = args[i];
    if ('string' !== typeof(arg)) {
      arg = JSON.stringify(arg);
    }

    if (-1 !== msg.indexOf('%' + i)) {
      msg = msg.replace('%' + i, arg);
    } else {
      if (msg.length) {
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

  private log_ = (level :string, args :any[]) :void => {
    var message :string;

    if (2 === args.length && 'string' === typeof(args[0]) && Array.isArray(args[1])) {
      args = [args[0]].concat(args[1].slice());
    }

    message = formatStringMessageWithArgs_(args);

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
  public debug = (...args :any[]) :void => {
    this.log_('debug', args);
  }
  // Logs message in info level.
  public info = (...args :any[]) :void => {
    this.log_('info', args);
  }
  // Logs message in warn level.
  public warn = (...args :any[]) :void => {
    this.log_('warn', args);
  }
  // Logs message in error level.
  public error = (...args :any[]) :void => {
    this.log_('error', args);
  }
}
