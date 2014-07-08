interface LogProvider {
   getEncrypedLogBuffer(...tags: string[]) : Promise<ArrayBuffer>;
   getLogs(...tags: string[]) : Promise<string>;
   reset() : Promise<void>;
   enable(newState: boolean) : Promise<void>;
   format(level: string, tag: string, msg: string, args: string[]) : string;
   setConsoleFilter(...args: string[]) : Promise<void>;
   debug(tag: string, msg: string, ...args: any[]) : Promise<void>;
   info(tag: string, msg: string, ...args: any[]) : Promise<void>;
   warn(tag: string, msg: string, ...args: any[]) : Promise<void>;
   error(tag: string, msg: string, ...args: any[]) : Promise<void>;

   providePromises(provider: Object) : void;
}

declare module freedom {
    function Logger(): LogProvider;
}

