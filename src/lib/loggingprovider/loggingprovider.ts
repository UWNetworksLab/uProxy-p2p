import * as logging from './loggingprovider.types';

declare const freedom: freedom.FreedomInModuleEnv;

// The freedom console provider.
export var freedomConsole = freedom['core.console']();

// Besides output to console, log can also be buffered for later retrieval
// through "getLogs". This is the maximum number of buffered log before it is
// trimmed. Assuming average log length is 80, the whole buffer size is about
// 80k. That should be easy to send through email, not much memory usage, and
// still enough to capture most issues.
export var MAX_BUFFERED_LOG = 1000;

// Logs waiting for the logger to exist.
export var logBuffer: logging.Message[] = [];

export var enabled = true;

const listeners :{[tag :string] :LoggingListener[]} = {};

// This represents a possible destination for log messages.  To make use of
// this, the class should be inherited from and the log_ method reimplemented
// to record the message in whichever way is best for that transport.
export class AbstractLoggingDestination {
  // These filters control what is displayed/saved for the different log types.
  // Entries for each type should be of the form:
  //   'tag': LEVEL
  // where LEVEL is the minimum level of log that will be processed for the
  // module 'tag'.  '*' is a wildcard tag that applies to any message that is not
  // specifically specified
  private filters_ :{[tag :string] :logging.Level} = {};

  constructor(private default_ :logging.Level) {}

  // This retrieves the minimum level that will cause some action on the part
  // of the logger for a given tag
  public getLevelForTag = (tag :string) :logging.Level => {
    return (tag in this.filters_) ? this.filters_[tag] : this.default_;
  }

  private checkFilter_ = (level :logging.Level, tag :string) => {
    return level >= this.getLevelForTag(tag);
  }

  protected log_ = (level :logging.Level, tag :string, message :logging.Message) :void => {
    throw Error('not implemented');
  }

  public log = (level :logging.Level, tag :string, message :logging.Message) :void => {
    if (this.checkFilter_(level, tag)) {
      this.log_(level, tag, message);
    }
  }

  // This method handles sending updates for the tags that have changed (and
  // only the tags that have changed) after calling the specified function
  // to do the change.
  private doFilterChanges_ = (doChange :Function) => {
    var oldLevels :{[tag :string] :logging.Level} = {};

    for (const tag in listeners) {
      oldLevels[tag] = getMinLevel(tag);
    }

    doChange();

    for (const tag in oldLevels) {
      if (oldLevels[tag] !== getMinLevel(tag)) {
        updateTag(tag);
      }
    }
  }

  public setDefaultFilter = (level :logging.Level) => {
    this.doFilterChanges_(() => {
      this.default_ = level;
    });
  }

  public setFilters = (filters :{[tag :string] :logging.Level}) => {
    // while it would be possible to limit the scope of what tags should be
    // checked for changes, it's easier to just check all of them
    this.doFilterChanges_(() => {
      this.filters_ = filters;
    });
  }

  public setFilter = (tag :string, level?:logging.Level) => {
    var oldLevel = getMinLevel(tag);

    if (typeof(level) === 'undefined' || level === null) {
      delete this.filters_[tag];
    } else {
      this.filters_[tag] = level;
    }

    if (getMinLevel(tag) !== oldLevel) {
      updateTag(tag);
    }
  }
}

// A logging destination for printing the message directly to the console
export class ConsoleLoggingDestination extends AbstractLoggingDestination {
  constructor() {
    super(logging.Level.debug);
  }

  protected log_ = (level :logging.Level, tag :string, message :logging.Message) :void => {
    if (level === logging.Level.debug) {
      freedomConsole.debug(tag, this.formatMessage_(message));
    } else if (level === logging.Level.info) {
      freedomConsole.info(tag, this.formatMessage_(message));
    } else if (level === logging.Level.warn) {
      freedomConsole.warn(tag, this.formatMessage_(message));
    } else {
      freedomConsole.error(tag, this.formatMessage_(message));
    }
  }

  // Exports the date and message fields, yielding something like:
  //   [2015-04-23T15:07:12.586Z] listening on port 9999
  // Since the Chrome and Firefox consoles provide some metadata support,
  // this ultimately results in something like this in the JavaScript
  // console:
  //   (i) simple-socks [2015-04-23T15:07:12.586Z] listening on port 9999
  // (where (i) is a cute little symbol indicating the level and the
  // tag, simple-socks is in red.
  private formatMessage_ = (l:logging.Message) : string => {
    return '[' + dateToString_(l.timestamp) + '] ' + l.message;
  }
}

export class BufferedLoggingDestination extends AbstractLoggingDestination {
  constructor() {
    super(logging.Level.error);
  }

  protected log_ = (level :logging.Level, tag :string, message :logging.Message) :void => {
    if (logBuffer.length > MAX_BUFFERED_LOG) {
      logBuffer.splice(0, MAX_BUFFERED_LOG / 10);
    }
    logBuffer.push(message);
  }
}

var loggingDestinations :{[name :number] :AbstractLoggingDestination} = {};
loggingDestinations[logging.Destination.console] =
  new ConsoleLoggingDestination();
loggingDestinations[logging.Destination.buffered] =
  new BufferedLoggingDestination();

function dateToString_(d:Date) : string {
  return d.toISOString();
}

// Interface for accumulating log messages.
export class Log implements logging.Log {
  private log_ = (level :logging.Level, tag :string, msg :string) :void => {
    if (!enabled) {
      return;
    }

    var message :logging.Message = {
      timestamp: new Date(),
      level: level,
      tag: tag,
      message: msg
    }

    for (var i in loggingDestinations) {
      loggingDestinations[i].log(level, tag, message);
    }
  }

  // Logs message in debug level.
  public debug = (source:string, msg: string) : void => {
    this.log_(logging.Level.debug, source, msg);
  }
  // Logs message in info level.
  public info = (source:string, msg: string) : void => {
    this.log_(logging.Level.info, source, msg);
  }
  public log = (source:string, msg: string) : void => {
    this.log_(logging.Level.info, source, msg);
  }
  // Logs message in warn level.
  public warn = (source:string, msg: string) : void => {
    this.log_(logging.Level.warn, source, msg);
  }
  // Logs message in error level.
  public error = (source:string, msg: string) : void => {
    this.log_(logging.Level.error, source, msg);
  }
}

function getMinLevel(tag :string) {
  var min = logging.Level.error;
  for (var i in loggingDestinations) {
    var level = loggingDestinations[i].getLevelForTag(tag);
    if (level < min) {
      min = level;
    }
  }
  return min;
}

function updateTag(tag :string) {
  if (!listeners[tag]) {
    return;
  }

  for (var i in listeners[tag]) {
    listeners[tag][i].update();
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

  // Exports log in plaintext.
  // If specified, tags limits the exported messages to those having any of
  // the specified tags.
  public getLogs = (tags?:string[]) : string[] => {
    // TODO: use input to select log message.
    if (!tags || tags.length === 0) {
      return logBuffer.map(this.formatMessage_);
    } else {
      return logBuffer.filter((m:logging.Message) => {
        return tags.indexOf(m.tag) >= 0;
      }).map(this.formatMessage_);
    }
  }

  // Exports all message fields, yielding something like:
  //   simple-socks I [2015-04-23T15:07:12.586Z] listening on port 9999
  private formatMessage_(l:logging.Message) : string {
    return l.tag + ' ' + logging.Level[l.level][0].toUpperCase() +
        ' [' + dateToString_(l.timestamp) + '] ' + l.message;
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

  public setDefaultFilter = (destination :logging.Destination, level :logging.Level) => {
    loggingDestinations[destination].setDefaultFilter(level);
  }

  public setFilters = (destination :logging.Destination,
                             filters :{ [tag :string] :logging.Level }) => {
    loggingDestinations[destination].setFilters(filters);
  }

  public setFilter = (destination :logging.Destination, tag :string,
                      level?:logging.Level) => {
    loggingDestinations[destination].setFilter(tag, level);
  }
}

// TODO - handle unbinding the listener if there is a disconnect event
export class LoggingListener implements logging.Listener {
  constructor(private dispatchEvent_ :(name :string, data :Object) => void,
              private tag_ :string) {
    if (!listeners[tag_]) {
      listeners[tag_] = [];
    }
    listeners[tag_].push(this);
    this.update();
  }

  public update = () => {
    this.dispatchEvent_('levelchange', getMinLevel(this.tag_));
  }
}
