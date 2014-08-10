/// <reference path="../../logging/logging.d.ts" />

module Freedom_UproxyLogging {

  // Class for managing logging and exporting logs.
  export class LogManager {
    // Dummy consturctor because freedom needs one.
    constructor(
      private module_:any,  // TODO: fix `any` type.
      // dispatchEvent_ is never used, hense void eventData.
      private dispatchEvent_:(eventType:string, eventData:void) => void) {}
    //
    public getEncrypedLogBuffer = (tags:string[],
        continuation:(encryptedLogs:ArrayBuffer) => void) : void => {
      continuation(Logging.getEncrypedLogBuffer(tags));
    }
    public getLogs =
        (tags:string[], continuation:(logs:Logging.Message[])=>void)
        : void => {
      continuation(Logging.getLogs(tags));
    }
    public clearLogs = (continuation:()=>void) : void => {
      Logging.clearLogs(); continuation();
    }
    public enable = (continuation:()=>void) : void => {
      Logging.enable(); continuation();
    }
    public disable = (continuation:()=>void) : void => {
      Logging.disable(); continuation();;
    }
    public setConsoleFilter = (args: string[], continuation:()=>void)
        : void => {
      Logging.setConsoleFilter(args); continuation();
    }
  }

  // Class for writing to log.
  export class Log {
    private logger_ :Logging.Log;
    constructor(
        // module_ is never used.
        private module_:any,  // TODO: fix `any` type.
        // dispatchEvent_ is never used, hense void eventData.
        private dispatchEvent_:(eventType:string, eventData:void) => void,
        // The |defaultTag_| is
        private tag_:string) {
      this.logger_ = new Logging.Log(tag_);
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
