/// <reference path='../../build/third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../build/third_party/freedom-typings/freedom-module-env.d.ts' />

import freedomTypes = require('freedom.types');

// Perform log message formatting. Formats an array of arguments to a
// single string.
// TODO: move this into the provider.
function formatStringMessageWithArgs_(msg:string, args :any[])
    : string {
  var formatted_msg = msg;

  for (var i = 0; i < args.length; i++) {
    formatted_msg = formatted_msg.replace('%' + (i + 1), args[i]);
  }

  return formatted_msg;
}

export class Log {
  private logger :Promise<freedomTypes.Logger>;
  constructor(private tag_:string) {
    this.logger = freedom.core().getLogger(this.tag_);
  }

  private log_ = (level :string, msg :string, args :any[]) :void => {
    var message :string;

    if (1 === args.length && Array.isArray(args[0])) {
      args = args[0];
    }

    message = formatStringMessageWithArgs_(msg, args);

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
  public debug = (msg: string, ...args :any[]) :void => {
    this.log_('debug', msg, args);
  }
  // Logs message in info level.
  public info = (msg: string, ...args :any[]) :void => {
    this.log_('info', msg, args);
  }
  // Logs message in warn level.
  public warn = (msg: string, ...args :any[]) :void => {
    this.log_('warn', msg, args);
  }
  // Logs message in error level.
  public error = (msg: string, ...args :any[]) :void => {
    this.log_('error', msg, args);
  }
}
